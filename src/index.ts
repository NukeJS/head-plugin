import { Handler } from 'swup';
import Plugin from '@swup/plugin';

import mergeHeadContents from './mergeHeadContents.js';
import updateLangAttribute from './updateLangAttribute.js';
import waitForAssets from './waitForAssets.js';

type Options = {
	/** Whether to keep orphaned `link`, `style` and `script` tags from the old page. Default: `false` */
	persistAssets: boolean;
	/** Tags that will be persisted when a new page is loaded. Boolean, selector or predicate function. Default: `false` */
	persistTags: boolean | string | ((el: Element) => boolean);
	/** Delay the transition to the new page until all newly added assets have finished loading. Default: `false` */
	awaitAssets: boolean;
	/** How long to wait for assets before continuing anyway. Only applies if `awaitAssets` is enabled. Default: `3000` */
	timeout: number;
};

export default class SwupHeadPlugin extends Plugin {
	name = 'SwupHeadPlugin';

	requires = { swup: '>=4.6' };

	defaults: Options = {
		persistTags: false,
		persistAssets: false,
		awaitAssets: false,
		timeout: 3000
	};
	options: Options;

	constructor(options: Partial<Options> = {}) {
		super();

		this.options = { ...this.defaults, ...options };

		// persistAssets is a shortcut for: persistTags with a default asset selector for scripts & styles
		if (this.options.persistAssets && !this.options.persistTags) {
			this.options.persistTags = 'link[rel=stylesheet], script[src], style';
		}
	}

	mount() {
		this.before('content:replace', this.updateHead);
	}

	updateHead: Handler<'content:replace'> = async (visit, { page: { html } }) => {
		const newDocument = visit.to.document!;

		const { removed, added } = mergeHeadContents(document.head, newDocument.head, {
			shouldPersist: (el) => this.isPersistentTag(el)
		});

		this.swup.log(`Removed ${removed.length} / added ${added.length} tags in head`);

		const lang = updateLangAttribute(document.documentElement, newDocument.documentElement);
		if (lang) {
			this.swup.log(`Updated lang attribute: ${lang}`);
		}

		if (this.options.awaitAssets) {
			const assetLoadPromises = waitForAssets(added, this.options.timeout);
			if (assetLoadPromises.length) {
				this.swup.log(`Waiting for ${assetLoadPromises.length} assets to load`);
				await Promise.all(assetLoadPromises);
			}
		}
	};

	isPersistentTag(el: Element) {
		const { persistTags } = this.options;
		if (typeof persistTags === 'function') {
			return persistTags(el);
		}
		if (typeof persistTags === 'string') {
			return el.matches(persistTags);
		}
		return Boolean(persistTags);
	}
}
