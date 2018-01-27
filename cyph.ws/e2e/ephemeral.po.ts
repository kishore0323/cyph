import {browser, by, element, ExpectedConditions} from 'protractor';


export class EphemeralPage {
	public async getFooterText () : Promise<string> {
		return element(by.css('cyph-footer a > span:first-child')).getText();
	}

	public async navigateTo () : Promise<void> {
		await browser.waitForAngularEnabled(false);
		await browser.get('/');
		await browser.wait(ExpectedConditions.presenceOf(element(by.css('body.load-complete'))));
	}

	public async reenableAngularWaiting () : Promise<void> {
		await browser.waitForAngularEnabled(true);
	}
}