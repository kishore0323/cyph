import {Analytics} from '../analytics';
import {Config} from '../config';
import {Potassium} from '../crypto/potassium';
import {EventManager} from '../eventmanager';
import {Firebase} from '../firebase';
import {Events, RPCEvents, Users} from '../session/enums';
import {ISession} from '../session/isession';
import {Message} from '../session/message';
import {Thread} from '../thread';
import {Util} from '../util';
import {UIEvents} from './enums';
import {IFiles} from './ifiles';
import {ITransfer} from './itransfer';
import {Transfer} from './transfer';


/**
 * Standard IFiles implementation built on Firebase.
 * For encryption, native crypto is preferred when available,
 * but libsodium in a separate thread is used as a fallback.
 */
export class Files implements IFiles {
	/** @ignore */
	private static async cryptoThread (
		threadLocals: {
			plaintext?: Uint8Array,
			cyphertext?: Uint8Array,
			key?: Uint8Array,
			chunkSize?: number,
			callbackId?: string
		}
	) : Promise<any[]> {
		threadLocals.chunkSize	= Config.filesConfig.chunkSize;
		threadLocals.callbackId	= 'files-' + Util.generateGuid();

		const thread	= new Thread(async function (
			cyph: any,
			Potassium: any,
			locals: any,
			importScripts: Function
		) {
			importScripts('/js/cyph/crypto/potassium.js');

			const potassium: Potassium	= new Potassium();

			/* Encrypt */
			if (locals.plaintext) {
				const key: Uint8Array	= Potassium.randomBytes(
					potassium.SecretBox.keyBytes
				);

				const chunks: Uint8Array[]	= [];

				for (let i = 0 ; i < locals.plaintext.length ; i += locals.chunkSize) {
					try {
						chunks.push(await potassium.SecretBox.seal(
							new Uint8Array(
								locals.plaintext.buffer,
								i,
								(locals.plaintext.length - i) > locals.chunkSize ?
									locals.chunkSize :
									undefined
							),
							key
						));
					}
					catch (err) {
						cyph.EventManager.trigger(
							locals.callbackId,
							[err.message, null, null]
						);

						return;
					}
				}

				const cyphertext: Uint8Array	= new Uint8Array(
					chunks.
						map(chunk => chunk.length + 4).
						reduce((a, b) => a + b, 0)
				);

				let j: number	= 0;
				for (let chunk of chunks) {
					cyphertext.set(
						new Uint8Array(new Uint32Array([chunk.length]).buffer),
						j
					);
					j += 4;

					cyphertext.set(chunk, j);
					j += chunk.length;

					Potassium.clearMemory(chunk);
				}

				cyph.EventManager.trigger(
					locals.callbackId,
					[null, cyphertext, key]
				);
			}
			/* Decrypt */
			else if (locals.cyphertext && locals.key) {
				const chunks: Uint8Array[]	= [];

				for (let i = 0 ; i < locals.cyphertext.length ;) {
					try {
						const chunkSize: number	= new DataView(
							locals.cyphertext.buffer,
							i
						).getUint32(0, true);

						i += 4;

						chunks.push(await potassium.SecretBox.open(
							new Uint8Array(
								locals.cyphertext.buffer,
								i,
								chunkSize
							),
							locals.key
						));

						i += chunkSize;
					}
					catch (err) {
						cyph.EventManager.trigger(
							locals.callbackId,
							[err.message, null]
						);

						return;
					}
				}

				const plaintext	= new Uint8Array(
					chunks.
						map(chunk => chunk.length).
						reduce((a, b) => a + b, 0)
				);

				let j: number	= 0;
				for (let chunk of chunks) {
					plaintext.set(chunk, j);
					j += chunk.length;

					Potassium.clearMemory(chunk);
				}

				cyph.EventManager.trigger(
					locals.callbackId,
					[null, plaintext]
				);
			}
		}, threadLocals);

		return new Promise<any[]>((resolve, reject) =>
			EventManager.one(threadLocals.callbackId, data => {
				thread.stop();

				const err	= data[0];
				if (err) {
					reject(err);
				}
				else {
					resolve(data.slice(1));
				}
			})
		);
	}


	/** @ignore */
	private nativePotassium: Potassium;

	/** @inheritDoc */
	public transfers: ITransfer[]	= [];

	/** @ignore */
	private async decryptFile (
		cyphertext: Uint8Array,
		key: Uint8Array
	) : Promise<Uint8Array> {
		try {
			return this.nativePotassium ?
				await this.nativePotassium.SecretBox.open(cyphertext, key) :
				(await Files.cryptoThread({cyphertext, key}))[0]
			;
		}
		catch (_) {
			return Potassium.fromString('File decryption failed.');
		}
	}

	/** @ignore */
	private async encryptFile (plaintext: Uint8Array) : Promise<{
		cyphertext: Uint8Array;
		key: Uint8Array;
	}> {
		try {
			if (this.nativePotassium) {
				const key: Uint8Array	= Potassium.randomBytes(
					this.nativePotassium.SecretBox.keyBytes
				);

				return {
					cyphertext: await this.nativePotassium.SecretBox.seal(
						plaintext,
						key
					),
					key
				};
			}
			else {
				const results	= await Files.cryptoThread({plaintext});

				return {
					cyphertext: results[0],
					key: results[1]
				};
			}
		}
		catch (_) {
			return {
				cyphertext: new Uint8Array(0),
				key: new Uint8Array(0)
			};
		}
	}

	/** @ignore */
	private receiveTransfer (transfer: ITransfer) : void {
		transfer.isOutgoing			= false;
		transfer.percentComplete	= 0;

		this.triggerUIEvent(
			UIEvents.confirm,
			transfer.name,
			transfer.size,
			true,
			async (ok: boolean) => {
				transfer.answer	= ok;

				this.session.send(new Message(
					RPCEvents.files,
					transfer
				));

				if (ok) {
					const transferIndex: number	= this.transfers.push(transfer) - 1;

					/* Arbitrarily assume ~500 Kb/s for progress bar estimation */
					const intervalId: number	= setInterval(() => {
						if (transfer.percentComplete >= 100) {
							clearInterval(intervalId);
						}
						else {
							transfer.percentComplete +=
								Util.random(100000, 25000) / transfer.size * 100
							;
						}
					}, 1000);

					const cyphertext: Uint8Array	= new Uint8Array(await Util.request({
						responseType: 'arraybuffer',
						retries: 5,
						/* Temporary workaround while Firebase adds CORS support */
						url: (transfer.url || '').replace(
							'firebasestorage.googleapis.com',
							'api.cyph.com'
						)
					}));

					transfer.percentComplete	= Math.max(
						transfer.percentComplete,
						85
					);

					Firebase.app.storage().refFromURL(transfer.url).delete();

					const plaintext: Uint8Array	= await this.decryptFile(
						cyphertext,
						transfer.key
					);

					transfer.percentComplete	= 100;

					Potassium.clearMemory(transfer.key);
					Util.saveFile(plaintext, transfer.name);
					setTimeout(() => this.transfers.splice(transferIndex, 1), 1000);
				}
				else {
					this.triggerUIEvent(
						UIEvents.rejected,
						transfer.name
					);

					Firebase.app.storage().refFromURL(transfer.url).delete();
				}
			}
		);
	}

	/** @ignore */
	private triggerUIEvent(
		event: UIEvents,
		...args: any[]
	) : void {
		this.session.trigger(Events.filesUI, {event, args});
	}

	/** @inheritDoc */
	public async send (plaintext: Uint8Array, name: string) : Promise<void> {
		if (plaintext.length > Config.filesConfig.maxSize) {
			this.triggerUIEvent(UIEvents.tooLarge);

			Analytics.send({
				eventAction: 'toolarge',
				eventCategory: 'file',
				eventValue: 1,
				hitType: 'event'
			});

			return;
		}

		let uploadTask: firebase.UploadTask;

		const transfer: ITransfer	= new Transfer(
			name,
			plaintext.length
		);

		const transferIndex: number	= this.transfers.push(transfer) - 1;

		Analytics.send({
			eventAction: 'send',
			eventCategory: 'file',
			eventValue: 1,
			hitType: 'event'
		});

		this.triggerUIEvent(
			UIEvents.started,
			Users.me,
			transfer.name
		);

		EventManager.one('transfer-' + transfer.id, (answer: boolean) => {
			transfer.answer	= answer;

			this.triggerUIEvent(
				UIEvents.completed,
				transfer.name,
				transfer.answer
			);

			if (transfer.answer === false) {
				this.transfers.splice(transferIndex, 1);

				if (uploadTask) {
					uploadTask.cancel();
				}
			}
		});

		this.session.send(new Message(
			RPCEvents.files,
			transfer
		));

		const o	= await this.encryptFile(plaintext);

		transfer.size	= o.cyphertext.length;
		transfer.key	= o.key;

		Util.retryUntilComplete(async (retry) => {
			const path: string	= 'ephemeral/' +  Util.generateGuid();

			uploadTask	= Firebase.app.storage().ref(path).put(new Blob([o.cyphertext]));

			uploadTask.on('state_changed',
				snapshot => {
					transfer.percentComplete	=
						snapshot.bytesTransferred /
						snapshot.totalBytes *
						100
					;
				},
				err => {
					if (transfer.answer !== false) {
						retry();
					}
				},
				() => {
					transfer.url	= uploadTask.snapshot.downloadURL;

					this.session.send(new Message(
						RPCEvents.files,
						transfer
					));

					this.transfers.splice(transferIndex, 1);
				}
			);
		});
	}

	constructor (
		/** @ignore */
		private session: ISession
	) { (async () => {
		const isNativeCryptoSupported	=
			await Potassium.isNativeCryptoSupported()
		;

		if (isNativeCryptoSupported) {
			this.session.on(Events.beginChat, () => this.session.send(
				new Message(RPCEvents.files)
			));
		}

		const downloadAnswers: {[id: string]: boolean}	= {};

		this.session.on(RPCEvents.files, (transfer?: ITransfer) => {
			if (transfer) {
				/* Outgoing file transfer acceptance or rejection */
				if (transfer.answer === true || transfer.answer === false) {
					EventManager.trigger('transfer-' + transfer.id, transfer.answer);
				}
				/* Incoming file transfer */
				else if (transfer.url) {
					Util.retryUntilComplete(retry => {
						if (downloadAnswers[transfer.id] === true) {
							downloadAnswers[transfer.id]	= null;
							this.receiveTransfer(transfer);
						}
						else if (downloadAnswers[transfer.id] !== false) {
							retry();
						}
					});
				}
				/* Incoming file transfer request */
				else {
					this.triggerUIEvent(
						UIEvents.started,
						Users.other,
						transfer.name
					);

					this.triggerUIEvent(
						UIEvents.confirm,
						transfer.name,
						transfer.size,
						false,
						(ok: boolean) => {
							downloadAnswers[transfer.id]	= ok;

							if (!ok) {
								this.triggerUIEvent(
									UIEvents.rejected,
									transfer.name
								);

								transfer.answer	= false;

								this.session.send(new Message(
									RPCEvents.files,
									transfer
								));
							}
						}
					);
				}
			}
			/* Negotiation on whether or not to use SubtleCrypto */
			else if (isNativeCryptoSupported && !this.nativePotassium) {
				this.nativePotassium	= new Potassium(true);
			}
		});
	})(); }
}
