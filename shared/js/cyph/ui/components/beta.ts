import {Templates} from '../templates';
import {Util} from '../../util';
import {UpgradeComponent} from '@angular/upgrade/static';
import {
	Directive,
	DoCheck,
	ElementRef,
	Inject,
	Injector,
	OnChanges,
	OnDestroy,
	OnInit,
	SimpleChanges
} from '@angular/core';


/**
 * Angular component for Cyph beta UI.
 */
@Directive({
	selector: 'cyph-beta'
})
export class Beta extends UpgradeComponent implements DoCheck, OnChanges, OnInit, OnDestroy {
	/** Component title. */
	public static title: string	= 'cyphBeta';

	/** Component configuration. */
	public static config		= {
		controller: Beta,
		template: Templates.beta
	};


	public Cyph: any;
	public ui: any;

	public checking: boolean	= false;
	public error: boolean		= false;

	ngDoCheck () { super.ngDoCheck(); }
	ngOnChanges (changes: SimpleChanges) { super.ngOnChanges(changes); }
	ngOnDestroy () { super.ngOnDestroy(); }
	ngOnInit () { super.ngOnInit(); }

	constructor (
		@Inject(ElementRef) elementRef: ElementRef,
		@Inject(Injector) injector: Injector
	) {
		super(Beta.title, elementRef, injector);

		(async () => {
			while (!self['Cyph'] || !self['ui']) {
				await Util.sleep(100);
			}

			this.Cyph	= self['Cyph'];
			this.ui		= self['ui'];

			const $elementRef	= $(elementRef);

			/* TODO: stop blatantly lying to people */
			$elementRef.find('form').submit(() => {
				this.checking	= true;
				this.error		= false;
				this.ui.controller.update();

				setTimeout(() => {
					this.checking	= false;
					this.error		= true;
					this.ui.controller.update();
				}, Util.random(4000, 1500));
			});
		})();
	}
}
