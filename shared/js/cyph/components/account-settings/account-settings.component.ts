import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {SecurityModels, User, usernameMask} from '../../account';
import {BaseProvider} from '../../base-provider';
import {emailPattern} from '../../email-pattern';
import {IAsyncValue} from '../../iasync-value';
import {StringProto} from '../../proto';
import {AccountSettingsService} from '../../services/account-settings.service';
import {AccountService} from '../../services/account.service';
import {AccountAuthService} from '../../services/crypto/account-auth.service';
import {AccountDatabaseService} from '../../services/crypto/account-database.service';
import {DialogService} from '../../services/dialog.service';
import {EnvService} from '../../services/env.service';
import {StringsService} from '../../services/strings.service';
import {toBehaviorSubject} from '../../util/flatten-observable';


/**
 * Angular component for account settings UI.
 */
@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	selector: 'cyph-account-settings',
	styleUrls: ['./account-settings.component.scss'],
	templateUrl: './account-settings.component.html'
})
export class AccountSettingsComponent extends BaseProvider implements OnInit {
	/** Data. */
	public readonly data	= new BehaviorSubject({
		current: {
			email: '',
			name: '',
			realUsername: ''
		},
		modified: {
			email: '',
			name: '',
			realUsername: ''
		},
		usernamePattern: ''
	});

	/** Email address. */
	public readonly email: IAsyncValue<string>	= this.accountDatabaseService.getAsyncValue(
		'email',
		StringProto,
		SecurityModels.unprotected
	);

	/** @see emailPattern */
	public readonly emailPattern	= emailPattern;

	/** Indicates whether page is loading. */
	public readonly loading			= new BehaviorSubject(true);

	/** Indicates whether data is ready to save. */
	public readonly ready: BehaviorSubject<boolean>;

	/** UI state. */
	public readonly state: Observable<number>			= this.activatedRoute.data.pipe(map(o =>
		typeof o.state === 'number' ? o.state : this.states.default
	));

	/** UI states. */
	public readonly states			= {
		default: 1,
		masterKey: 2,
		pin: 3
	};

	/** User. */
	public readonly user			= new BehaviorSubject<User|undefined>(undefined);

	/** @see usernameMask */
	public readonly usernameMask	= usernameMask;

	/** @ignore */
	private async changePasswordInternal <T> (
		password: T,
		requiredState: number,
		dialogConfig: {content: string; failureContent: string; title: string},
		changePassword: (password: T) => Promise<void>
	) : Promise<void> {
		const user	= this.user.value;
		if (
			!user ||
			(await this.state.pipe(take(1)).toPromise()) !== requiredState
		) {
			return;
		}

		if (!(await this.dialogService.confirm({
			content: dialogConfig.content,
			markdown: true,
			title: dialogConfig.title
		}))) {
			return;
		}

		this.loading.next(true);

		try {
			await changePassword(password);
		}
		catch {
			await this.dialogService.alert({
				content: dialogConfig.failureContent,
				markdown: true,
				title: dialogConfig.title
			});
		}

		this.router.navigate([accountRoot, 'settings']);
		this.loading.next(false);
	}

	/** Saves master key update. */
	public async changeMasterKey (masterKey: string) : Promise<void> {
		return this.changePasswordInternal(
			masterKey,
			this.states.masterKey,
			{
				content: this.stringsService.changeMasterKeyContent,
				failureContent: this.stringsService.changeMasterKeyFailure,
				title: this.stringsService.changeMasterKeyTitle
			},
			async p => this.accountAuthService.changeMasterKey(p)
		);
	}

	/** Saves lock screen password update. */
	public async changePIN (pin: {isCustom: boolean; value: string}) : Promise<void> {
		return this.changePasswordInternal(
			pin,
			this.states.pin,
			{
				content: this.stringsService.changePinContent,
				failureContent: this.stringsService.changePinFailure,
				title: this.stringsService.changePinTitle
			},
			async p => this.accountAuthService.changePIN(p)
		);
	}

	/** @inheritDoc */
	public async ngOnInit () : Promise<void> {
		this.accountService.transitionEnd();

		const {user}	= await this.accountDatabaseService.getCurrentUser();

		this.user.next(user);

		const [email, {name, realUsername}]	= await Promise.all([
			this.email.getValue(),
			user.accountUserProfile.getValue()
		]);

		const current	= {
			email,
			name,
			realUsername: realUsername.toLowerCase() === user.username ?
				realUsername :
				user.username
		};

		this.updateData({
			current,
			modified: current,
			usernamePattern: user.username.split('').map(c => `[${c.toUpperCase()}${c}]`).join('')
		});

		this.loading.next(false);
	}

	/** Saves data updates. */
	public async save () : Promise<void> {
		const user	= this.user.value;
		if (!user || !this.ready.value) {
			return;
		}

		this.loading.next(true);

		const data			= this.data.value;
		const email			= data.modified.email.trim();
		const name			= data.modified.name.trim();
		const realUsername	= data.modified.realUsername.trim();

		await Promise.all([
			data.current.email === email ?
				undefined :
				this.email.setValue(email)
			,
			data.current.name === name && data.current.realUsername === realUsername ?
				undefined :
				user.accountUserProfile.updateValue(async o => ({...o, name, realUsername}))
		]);

		this.updateData({current: {email, name, realUsername}});

		this.loading.next(false);
	}

	/** Updates draft. */
	public updateData (data: {
		current?: {
			email?: string;
			name?: string;
			realUsername?: string;
		};
		modified?: {
			email?: string;
			name?: string;
			realUsername?: string;
		};
		usernamePattern?: string;
	}) : void {
		this.data.next({
			current: {
				...this.data.value.current,
				...data.current
			},
			modified: {
				...this.data.value.modified,
				...data.modified
			},
			usernamePattern: data.usernamePattern || this.data.value.usernamePattern
		});
	}

	constructor (
		/** @ignore */
		private readonly activatedRoute: ActivatedRoute,

		/** @ignore */
		private readonly router: Router,

		/** @ignore */
		private readonly accountAuthService: AccountAuthService,

		/** @ignore */
		private readonly dialogService: DialogService,

		/** @see AccountService */
		public readonly accountService: AccountService,

		/** @see AccountDatabaseService */
		public readonly accountDatabaseService: AccountDatabaseService,

		/** @see AccountSettingsService */
		public readonly accountSettingsService: AccountSettingsService,

		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {
		super();

		this.ready	= toBehaviorSubject(
			combineLatest(this.data, this.user).pipe(map(([data, user]) =>
				!!user &&
				(
					data.current.email !== data.modified.email ||
					data.current.name !== data.modified.name ||
					data.current.realUsername !== data.modified.realUsername
				) &&
				!!data.modified.name &&
				data.modified.realUsername.toLowerCase() === user.username
			)),
			false,
			this.subscriptions
		);
	}
}
