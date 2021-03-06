import {Injectable} from '@angular/core';
import {BaseProvider} from '../base-provider';
import {ISessionCapabilitiesService} from '../service-interfaces/isession-capabilities.service';
import {resolvable} from '../util/wait';


/** Accounts implementation of ISessionCapabilitiesService. */
@Injectable()
export class AccountSessionCapabilitiesService
extends BaseProvider
implements ISessionCapabilitiesService {
	/** @ignore */
	private readonly _P2P_SUPPORT	= resolvable<boolean>();

	/** @ignore */
	private readonly _WALKIE_TALKIE	= resolvable<boolean>();

	/** @inheritDoc */
	public readonly capabilities										= {
		p2p: this._P2P_SUPPORT.promise,
		walkieTalkieMode: this._WALKIE_TALKIE.promise
	};

	/** @inheritDoc */
	public readonly resolveP2PSupport: (isSupported: boolean) => void	=
		this._P2P_SUPPORT.resolve
	;

	/** @inheritDoc */
	public readonly resolveWalkieTalkieMode: (walkieTalkieMode: boolean) => void	=
		this._WALKIE_TALKIE.resolve
	;

	constructor () {
		super();
	}
}
