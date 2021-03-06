import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import clipboard from 'clipboard-polyfill';
import * as $ from 'jquery';
import {BehaviorSubject} from 'rxjs';
import {filter, take} from 'rxjs/operators';
import {BaseProvider} from '../../base-provider';
import {ChatService} from '../../services/chat.service';
import {ConfigService} from '../../services/config.service';
import {DialogService} from '../../services/dialog.service';
import {EnvService} from '../../services/env.service';
import {SessionService} from '../../services/session.service';
import {StringsService} from '../../services/strings.service';
import {Timer} from '../../timer';
import {lockTryOnce} from '../../util/lock';
import {sleep, waitForIterable} from '../../util/wait';


/**
 * Angular component for a link-based initial connection screen
 * (e.g. for starting a new cyph).
 */
@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	selector: 'cyph-link-connection',
	styleUrls: ['./link-connection.component.scss'],
	templateUrl: './link-connection.component.html'
})
export class LinkConnectionComponent extends BaseProvider implements AfterViewInit {
	/** @ignore */
	private readonly addTimeLock: {}	= {};

	/** @ignore */
	private connectLinkInput?: HTMLInputElement;

	/** @ignore */
	private readonly copyLock: {}		= {};

	/** @ignore */
	private linkConstant: string		= '';

	/** Indicates whether the advanced features menu is open. */
	public readonly advancedFeatures	= new BehaviorSubject<boolean>(false);

	/** Indicates whether this link connection was initiated passively via API integration. */
	public readonly isPassive			= new BehaviorSubject<boolean>(false);

	/** The link to join this connection. */
	public readonly link				= new BehaviorSubject<string>('');

	/** Safe version of this link. */
	public readonly linkHref			= new BehaviorSubject<SafeUrl|undefined>(undefined);

	/** Safe mailto version of this link. */
	public readonly linkMailto			= new BehaviorSubject<SafeUrl|undefined>(undefined);

	/** Safe SMS version of this link. */
	public readonly linkSMS				= new BehaviorSubject<SafeUrl|undefined>(undefined);

	/** Draft of queued message. */
	public readonly queuedMessageDraft	= new BehaviorSubject<string>('');

	/** Counts down until link expires. */
	public readonly timer				= new Timer(this.configService.cyphCountdown, false);

	/** Extends the countdown duration. */
	public async addTime (milliseconds: number) : Promise<void> {
		this.timer.addTime(milliseconds);

		await lockTryOnce(
			this.addTimeLock,
			async () => { await this.dialogService.toast(
				this.stringsService.timeExtended,
				2500
			); }
		);
	}

	/** Copies link to clipboard. */
	public async copyToClipboard () : Promise<void> {
		await lockTryOnce(
			this.copyLock,
			async () => { await this.dialogService.toast(
				await clipboard.writeText(this.linkConstant).
					then(() => this.stringsService.linkCopied).
					catch(() => this.stringsService.linkCopyFail)
				,
				2500
			); }
		);
	}

	/** @inheritDoc */
	public async ngAfterViewInit () : Promise<void> {
		let isWaiting		= true;

		const sharedSecret	=
			await this.sessionService.state.sharedSecret.pipe(
				filter(s => s.length > 0),
				take(1)
			).toPromise()
		;

		this.isPassive.next(this.sessionService.state.wasInitiatedByAPI.value);

		if (this.isPassive.value || !this.sessionService.state.startingNewCyph.value) {
			return;
		}

		this.linkConstant	=
			this.envService.newCyphUrl +
			(this.envService.newCyphUrl.indexOf('#') > -1 ? '' : '#') +
			sharedSecret
		;

		const linkEncoded	= encodeURIComponent(this.linkConstant);

		this.link.next(this.linkConstant);

		this.linkHref.next(this.linkConstant);

		this.linkMailto.next(this.domSanitizer.bypassSecurityTrustUrl(
			`mailto:?subject=Cyph&body=${linkEncoded}`
		));

		this.linkSMS.next(this.domSanitizer.bypassSecurityTrustUrl(
			this.envService.smsUriBase + linkEncoded
		));

		if (this.elementRef.nativeElement && this.envService.isWeb) {
			const $element		= $(this.elementRef.nativeElement);

			if (this.envService.isMobileOS) {
				const $connectLinkLink	= await waitForIterable(
					() => $element.find('.connect-link-link')
				);

				/* Only allow right-clicking (for copying the link) */
				$connectLinkLink.on('click', e => { e.preventDefault(); });
			}
			else {
				this.connectLinkInput	= <HTMLInputElement> (await waitForIterable(
					() => document.querySelectorAll('.connect-link-input')
				))[0];

				this.onBlur();
			}

			await waitForIterable(() => $element.filter(':visible'));
		}
		else {
			/* TODO: HANDLE NATIVE */
		}

		this.sessionService.connected.then(() => {
			isWaiting			= false;
			this.linkConstant	= '';

			this.link.next('');
			this.linkHref.next(undefined);
			this.linkMailto.next(undefined);
			this.linkSMS.next(undefined);

			this.timer.stop();
		});

		await sleep(1000);
		await this.timer.start();

		if (isWaiting) {
			isWaiting	= false;
			this.chatService.abortSetup();
		}
	}

	/** Blur event handler. */
	public async onBlur () : Promise<void> {
		await sleep(0);

		if (!this.connectLinkInput || this.advancedFeatures.value) {
			return;
		}

		this.connectLinkInput.focus();
		this.connectLinkInput.setSelectionRange(0, this.linkConstant.length);
	}

	/** Resets link value. */
	public async resetLinkValue (value: string) : Promise<void> {
		this.link.next(value);
		await sleep(0);
		this.link.next(this.linkConstant);
		await sleep(0);

		this.onBlur();
	}

	constructor (
		/** @ignore */
		private readonly domSanitizer: DomSanitizer,

		/** @ignore */
		private readonly elementRef: ElementRef,

		/** @ignore */
		private readonly configService: ConfigService,

		/** @ignore */
		private readonly dialogService: DialogService,

		/** @see ChatService */
		public readonly chatService: ChatService,

		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see SessionService */
		public readonly sessionService: SessionService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {
		super();
	}
}
