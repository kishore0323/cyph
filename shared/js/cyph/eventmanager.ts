/// <reference path="env.ts" />
/// <reference path="thread.ts" />
/// <reference path="../global/base.ts" />


module Cyph {
	export class EventManager {
		private static handlers: {[event: string] : Function[]}	= {};

		public static mainThreadEvents: string	= 'mainThreadEvents';
		public static untriggeredEvents: string	= 'untriggeredEvents';

		public static off (event: string, handler: Function) : void {
			EventManager.handlers[event]	=
				(EventManager.handlers[event] || []).filter(f => f != handler)
			;
		}

		public static on (event: string, handler: Function) : void {
			EventManager.handlers[event]	= EventManager.handlers[event] || [];
			EventManager.handlers[event].push(handler);
		}

		public static trigger (event: string, data?: any, shouldTrigger: boolean = Env.isMainThread) : void {
			if (!shouldTrigger) {
				EventManager.trigger(EventManager.untriggeredEvents, {event, data}, true);
			}
			else {
				(EventManager.handlers[event] || []).forEach(handler => handler(data));

				if (Env.isMainThread) {
					Thread.threads.forEach((thread: Thread) =>
						thread.postMessage({event, data, isThreadEvent: true})
					);
				}
			}
		}
	}
}


if (Cyph.Env.isMainThread) {
	Cyph.EventManager.on(Cyph.EventManager.mainThreadEvents, (o: { method: string; args: any[]; }) =>
		Cyph.Thread.callMainThread(o.method, o.args)
	);
}
else {
	self.onmessage	= (e: MessageEvent) => {
		if (e.data && e.data.isThreadEvent) {
			Cyph.EventManager.trigger(e.data.event, e.data.data, true);
		}
		else if (Cyph.Thread.onmessage) {
			Cyph.Thread.onmessage(e);
		}
	};

	Cyph.EventManager.on(Cyph.EventManager.untriggeredEvents, (o: { event: string; data: any; }) =>
		postMessage({event: o.event, data: o.data, isThreadEvent: true}, null)
	);
}
