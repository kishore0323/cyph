import {AccountsPage} from './accounts.po';
import { setTimeout } from 'timers';


describe('Accounts', () => {
	let page: AccountsPage;

	beforeEach(async (done) => {
		page	= new AccountsPage();
		await page.navigateTo();
		done();
	});

	it('has title', async () => {
		expect(await page.getPageTitle()).toEqual('Cyph – Encrypted Messenger');
	});

	it('displays login page', async () => {
		expect(await page.getLoginTitleText()).toEqual('Log in to Cyph');
	});

	it('logs in', async () => {
		await page.logIn();
		expect(await page.elements.menu.root().isPresent()).toBe(true);
		expect(await page.elements.profile.root().isPresent()).toBe(true);
	});

	it('uploads file', async () => {
		await page.logIn();
		page.clickElement(page.elements.menu.files);
		await page.deleteAllFiles();
		expect(await page.elements.files.firstFile().isPresent()).toBe(false);
		await page.elements.files.upload().sendKeys(page.filePath);
		await page.waitForElement(page.elements.files.firstFile);
		expect(await page.elements.files.firstFile().isPresent()).toBe(true);
	});
});
