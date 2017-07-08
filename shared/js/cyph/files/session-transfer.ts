import {users} from '../session/enums';
import {ISessionTransfer} from '../../proto';
import {util} from '../util';


/** @inheritDoc */
export class SessionTransfer implements ISessionTransfer {
	constructor (
		/** @inheritDoc */
		public readonly name: string = '',

		/** @inheritDoc */
		public readonly mediaType: string = '',

		/** @inheritDoc */
		public readonly image: boolean = false,

		/** @inheritDoc */
		public readonly imageSelfDestructTimeout: number = 0,

		/** @inheritDoc */
		public readonly size: number = 0,

		/** @inheritDoc */
		public readonly key: Uint8Array = new Uint8Array(0),

		/** @inheritDoc */
		public isOutgoing: boolean = true,

		/** @inheritDoc */
		public url: string = '',

		/** @inheritDoc */
		public readonly id: string = util.uuid(),

		/** @inheritDoc */
		public answer?: boolean,

		/** @inheritDoc */
		public author: string = users.me,

		/** @inheritDoc */
		public receiptTimestamp?: number
	) {}
}