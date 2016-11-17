import {Templates} from '../templates';
import {IChat} from '../chat/ichat';
import {Util} from '../../util';
import {UpgradeComponent} from '@angular/upgrade/static';
import {
	Directive,
	DoCheck,
	ElementRef,
	Inject,
	Injector,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	SimpleChanges
} from '@angular/core';


/**
 * Angular component for chat cyphertext UI.
 */
@Directive({
	selector: 'cyph-chat-cyphertext'
})
export class ChatCyphertext extends UpgradeComponent implements DoCheck, OnChanges, OnInit, OnDestroy {
	/** Component title. */
	public static title: string	= 'cyphChatCyphertext';

	/** Component configuration. */
	public static config		= {
		bindings: {
			self: '<'
		},
		controller: ChatCyphertext,
		template: Templates.chatCyphertext
	};


	public Cyph: any;
	@Input() self: IChat;

	ngDoCheck () { super.ngDoCheck(); }
	ngOnChanges (changes: SimpleChanges) { super.ngOnChanges(changes); }
	ngOnDestroy () { super.ngOnDestroy(); }
	ngOnInit () { super.ngOnInit(); }

	constructor (
		@Inject(ElementRef) elementRef: ElementRef,
		@Inject(Injector) injector: Injector
	) {
		super(ChatCyphertext.title, elementRef, injector);

		(async () => {
			while (!self['Cyph']) {
				await Util.sleep(100);
			}

			this.Cyph	= self['Cyph'];
		})();
	}
}
