interface CustomInput extends HTMLInputElement {
	errorElm: HTMLElement;
	errorObj: Map<string, boolean>;
	wiredclickToViewIfRedacted: boolean;
	shake: () => void;
}

interface CustomErrorElm extends HTMLElement {
	errorObj?: Map<string, boolean>;
}

interface ValidatorOptions {
	inputElm: CustomInput | string | ((opts: ValidatorOptions) => CustomInput);
	errorElm?: CustomErrorElm;
	required?: boolean | ((value: string) => boolean);
	minLength?: number;
	maxLength?: number;
	exactLength?: number;
	pattern?: RegExp;
	maskHideSecretOnBlur?: boolean;
	revealedInputType?: string;
	setInputType?: (type: string) => void;
	clickToViewIfRedacted?: (
		value: string
	) => boolean | string | Promise<boolean | string>;
	customValidator?: (
		value: string
	) => boolean | string | Promise<boolean | string>;
	formatNumber?: boolean;
	wholeNumbersOnly?: boolean;
	mask?: string | ((inputElm: CustomInput) => string);
	maskSlots?: string;
	noMaskTrim?: boolean;
	dataAccept?: RegExp | string;
	allowUnacceptedChars?: boolean;
	unmaskInputValueProp?: boolean;
	showFullMaskWhileTyping?: boolean;
	hideDotSlots?: boolean;
	validateUnMaskedValue?: boolean;
	validateOnInput?: boolean;
	isNumeric?: boolean;
	customErrorMessages?: {
		isRequired?: string;
		inputNotLongEnough?: string;
		inputLengthTooLong?: string;
		patternNotValid?: string;
		customNotValid?: string;
	};
}

interface ValidatorOptionsWithErrorElm extends ValidatorOptions {
	errorElm: CustomErrorElm;
}

// a deduplicated list of all the inputs and errorElements that are registered by setupInput
const inputElms = new Map();
const errorElms = new Map();

const keyDownEvent = "keydown";
const inputEvent = "input";
const blurEvent = "blur";
const clickEvent = "click";
const focusEvent = "focus";
const resetEvent = "reset";

const numberFormatter = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 20,
});

function countPeriods(input: string): number {
	const matches = input.match(/\./g);
	return matches ? matches.length : 0;
}

function setupValidatorInput(opts: ValidatorOptions) {
	opts.inputElm = getInputElm(opts) as CustomInput;
	opts.errorElm = getErrorElm(opts);

	validateOptions(opts);

	const inputElm = opts.inputElm;

	opts.errorElm = opts.errorElm || createErrorElementForInput(inputElm);
	opts = mergeDefaultOptions(opts);

	if (!opts.mask && opts.formatNumber) {
		opts.unmaskInputValueProp = true;
		opts.validateUnMaskedValue = true;
		opts.maskSlots = "_";
		opts.showFullMaskWhileTyping = false;
		opts.mask = (inp: string | HTMLInputElement) => {
			const isStr = typeof inp === "string";
			const val = isStr ? inp : inp.value;

			let stripped = val.replaceAll(/[^\d.]/g, "");
			let last = stripped.at(-1);
			const decimalCount = countPeriods(stripped);
			if (decimalCount > 1 && last === ".") {
				stripped = stripped.slice(0, stripped.length - 1);
				last = "";
			}

			const number = Number(stripped);
			const formatted = numberFormatter.format(number);
			const mask = formatted.replaceAll(/\d/g, "_");
			if (last === "." && opts.wholeNumbersOnly !== true) return mask + "._";
			return mask;
		};
	}

	setupOptionPropertyGettersAndSetters(opts);

	const errorElm = opts.errorElm;
	const form = inputElm.form ?? wrapElementInDefaultForm(inputElm);

	// this for situations where the input is hidden because it is managed by an
	// external library like uncontrolled components in headless ui that
	// maintain the state/value in a regular hidden input.
	// We want to be able to validate its value and show errors if needed.
	// Since this library leans heavily on browser validation api's and
	// the browser doesn't run validation on hidden inputs
	// we change it to text, unhide it and display none so the user still doesn't
	// see it but the browser will run validation on it
	if (inputElm.type === "hidden") {
		inputElm.type = "text";
		inputElm.hidden = false;
		inputElm.dataset.supposedToBeHidden = "true";
		inputElm.readOnly = false;
		inputElm.style.display = "none";
	}

	inputElm.errorElm = errorElm as HTMLElement;
	inputElm.shake = () => shakeInput(inputElm);

	inputElms.set(inputElm, opts);
	errorElms.set(errorElm, opts);
	errorElm!.errorObj = errorElm!.errorObj || new Map();

	if (opts.mask) VMasker(inputElm);
	if (!opts.mask) setupValueProxy(inputElm);

	if (!opts.mask && !opts.clickToViewIfRedacted && opts.revealedInputType) {
		opts.setInputType?.(opts.revealedInputType);
	}

	if (
		!opts.mask &&
		opts.clickToViewIfRedacted &&
		!inputElm.wiredclickToViewIfRedacted
	) {
		setTimeout(() => {
			opts.setInputType?.("password");
			inputElm.value = "REDACTED";
		}, 0);

		const clickHandler = async () => {
			const results = opts.clickToViewIfRedacted!(inputElm.value);
			let result: string | boolean;
			if (results instanceof Promise) {
				result = await results;
			} else {
				result = results;
			}

			if (result === true) {
				setTimeout(() => {
					opts.setInputType?.(opts.revealedInputType || "text");
				}, 0);
				inputElm.removeEventListener(clickEvent, clickHandler);
				return;
			}
			if (typeof result === "string") {
				setTimeout(() => {
					opts.setInputType?.(opts.revealedInputType || "text");
					inputElm.value = result;
				}, 0);
				inputElm.removeEventListener(clickEvent, clickHandler);
				return;
			}
		};
		inputElm.addEventListener(clickEvent, clickHandler);
		inputElm.wiredclickToViewIfRedacted = true;
	}

	addEventListener(inputElm, blurEvent, onBlur);
	addEventListener(inputElm, inputEvent, onInput);
	addEventListener(inputElm, keyDownEvent, onKeyDown);

	if (!form) wrapElementInDefaultForm(inputElm);
	addEventListener(form, resetEvent, () => resetInput(inputElm));

	!form.zwcSubmitValidation && addEventListener(form, "submit", onSubmit, true);
	form.zwcSubmitValidation = true;
	form.noValidate = true; //disable browser validation, we got it from here

	form.zwcValidateForm = () => {
		checkAll(form);
		return form.checkValidity();
	};
}

function wrapElementInDefaultForm(inputElm: HTMLInputElement) {
	const form = document.createElement("form");
	form.dataset.warning =
		"Validator inputs require a form to work properly, and since this input element did not belong to one at the time of creation we create a default one instead of throwing an error.  This allows you to use the validator input for one offs without needing to add all the form boilerplate, but could potentially cause issues if you aren't expecting this.  The recommendation to make sure validator inputs are wrapped in a form yourself is strongly encouraged.";
	inputElm.after(form);
	form.appendChild(inputElm);
	return form;
}

function addEventListener(
	elm: HTMLFormElement | HTMLInputElement,
	event: string,
	func: any,
	opts = {}
) {
	elm.addEventListener(event, func, opts);
}

function ObjectDefineProperty(
	obj: any,
	propName: string,
	opts: PropertyDescriptor & ThisType<any>
) {
	try {
		return Object.defineProperty(obj, propName, opts);
	} catch (error) {
		return obj;
	}
}

function ObjectGetOwnPropertyDescriptor(proto: any, propName: string) {
	return Object.getOwnPropertyDescriptor(proto, propName);
}

function setupValueProxy(inputElm: CustomInput) {
	var valueProp = ObjectGetOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value"
	);

	const opts = inputElms.get(inputElm);

	const setVal = (newValue: any) => valueProp!.set!.call(inputElm, newValue);
	const getVal = () => valueProp!.get!.call(inputElm);

	ObjectDefineProperty(inputElm, "value", {
		get: () => {
			if (inputElm.dataset.object) {
				return (inputElm as any).objectRef ?? null;
			} else if (inputElm.type === "checkbox") {
				return inputElm.checked;
			} else {
				return getVal();
			}
		},
		set: (newValue: string) => {
			if (inputElm.dataset.object) {
				(inputElm as any).objectRef = newValue;
			} else if (inputElm.type === "checkbox") {
				inputElm.checked = Boolean(newValue);
			} else {
				if (opts.clickToViewIfRedacted) {
					setVal("REDACTED");
				} else {
					setVal(newValue);
				}
			}
			const blurEv = new Event(blurEvent);
			inputElm.dispatchEvent(blurEv);
		},
	});
}

function querySel(selector: string) {
	return document.querySelector(selector);
}

function getInputElm(opts: ValidatorOptions) {
	if (typeof opts.inputElm === "function") return opts.inputElm(opts);
	if (typeof opts.inputElm === "string") return querySel(opts.inputElm);
	return opts.inputElm as HTMLInputElement;
}

function getErrorElm(opts: any) {
	if (typeof opts.errorElm === "function") return opts.errorElm(opts);
	if (typeof opts.errorElm === "string") return querySel(opts.errorElm);
	return opts.errorElm as HTMLElement;
}

function mergeDefaultOptions(opts: ValidatorOptions) {
	const testString = `abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890 !@#$%^&*()_+-=[]\;',./{}|:"<>?`;
	let accept: RegExp;
	let matchedChars: RegExpMatchArray | null;
	try {
		accept = new RegExp(opts.dataAccept || "[\\d\\w]", "g");
		matchedChars = testString.match(accept);
	} catch (e) {
		console.error(`${opts.dataAccept} is not a valid regex.`, e);
		matchedChars = testString.match(new RegExp("[\\d\\w]", "g"));
	}

	const defaults = {
		inputElm: null,
		errorElm: null,
		required: false,
		minLength: null,
		maxLength: null,
		exactLength: null,
		pattern: null,
		customValidator: null,
		mask: null,
		maskSlots: null,
		maskHideSecretOnBlur: false,
		noMaskTrim: false,
		dataAccept: null,
		allowUnacceptedChars: false,
		unmaskInputValueProp: false,
		showFullMaskWhileTyping: false,
		hideDotSlots: true,
		validateUnMaskedValue: true,
		validateOnInput: true,
		isNumeric: opts.dataAccept && matchedChars?.length === 10,
		customErrorMessages: {
			isRequired: null,
			inputNotLongEnough: null,
			inputLengthTooLong: null,
			patternNotValid: null,
		},
	};

	return { ...defaults, ...opts } as ValidatorOptionsWithErrorElm;
}

export function shakeInput(inputElm: any) {
	inputElm.style.transition = "all 0.1s";
	inputElm.style.transform = "translateX(5px)";
	setTimeout(() => {
		inputElm.style.transform = "translateX(-5px)";
		setTimeout(() => {
			inputElm.style.transform = "translateX(5px)";
			setTimeout(() => {
				inputElm.style.transform = "translateX(-5px)";
				setTimeout(() => {
					inputElm.style.transform = "translateX(0)";
					setTimeout(() => {
						inputElm.style.transition = "all 0.3s";
					}, 50);
				}, 50);
			}, 50);
		}, 50);
	}, 50);
}

function setupOptionPropertyGettersAndSetters(opts: any) {
	opts.inputElm.mask = opts.mask;
	opts.inputElm.maskSlots = opts.maskSlots;
	opts.inputElm.dataAccept = opts.dataAccept;
	opts.inputElm.noMaskTrim = opts.noMaskTrim;
	opts.inputElm.unmaskInputValueProp = opts.unmaskInputValueProp;
	opts.inputElm.showFullMaskWhileTyping = opts.showFullMaskWhileTyping;
	opts.inputElm.hideDotSlots = opts.hideDotSlots;
	opts.inputElm.maskHideSecretOnBlur = opts.maskHideSecretOnBlur;
	opts.inputElm.clickToViewIfRedacted = opts.clickToViewIfRedacted;
	opts.inputElm.revealedInputType = opts.revealedInputType;
	opts.inputElm.setInputType = opts.setInputType;
	opts.inputElm.validatorOptions = opts;

	const proxyOption = (prop: any) =>
		ObjectDefineProperty(opts.inputElm.validatorOptions, prop, {
			get: () => opts.inputElm[prop],
			set: (newValue) => (opts.inputElm[prop] = newValue),
		});

	const optionsToProxy = [
		"mask",
		"maskSlots",
		"noMaskTrim",
		"dataAccept",
		"unmaskInputValueProp",
		"showFullMaskWhileTyping",
		"hideDotSlots",
	];

	optionsToProxy.forEach((prop) => proxyOption(prop));
}

function validateOptions(opts: any) {
	if (!opts.inputElm) console.error(`inputElm is a required option`);
	if (opts.inputElm.nodeName !== `INPUT`)
		console.error(`inputElm must be an INPUT element`);

	const name = opts.inputElm.name;
	const prefix = ` - ${name} - invalid config - `;

	if (opts.inputElm.type === "number" && opts.formatNumber)
		console.error(
			`number input ${opts.inputElm.name} has the 'type' attribute set to "number" and the 'formatNumber' prop set to true, which will attempt to insert commas, which number inputs do not support, please remove the explicit type prop on this input and let the framework handle this type for you`
		);

	if (!(opts.errorElm instanceof HTMLElement))
		console.error(`${prefix} errorElm must be an HTML Element`);

	if (opts.mask && !opts.maskSlots)
		console.error(`${prefix} cannot define a mask without defining a maskSlot`);

	if (opts.minLength && opts.exactLength)
		console.error(
			`${prefix} cannot define both minLength and exactLength, pick one.`
		);

	if (opts.maxLength && opts.exactLength)
		console.error(
			`${prefix} cannot define both maxLength and exactLength, pick one.`
		);

	const patternWithoutMinLength =
		opts.pattern &&
		!(opts.minLength || opts.exactLength || !opts.validateOnInput);
	const customWithoutMinLength =
		opts.customValidator &&
		!(opts.minLength || opts.exactLength || !opts.validateOnInput);

	if (patternWithoutMinLength || customWithoutMinLength)
		console.error(
			`${prefix} need to define minLength, exactLength, or set validateOnInput: false when using pattern or custom validators.  Otherwise the user will be shown errors immediately as they start typing. This leads to poor UX.  Ideally, we want to give the user a chance to put in the correct input before yelling at them. If your pattern cannot possibly be valid when the input is below a certain length, then we want to wait until that minimum length is met before attempting this validation.`
		);

	if (opts.mask) {
		let accept: RegExp;
		let maskContainsAcceptChars: RegExpMatchArray | null;
		try {
			accept = new RegExp(opts.dataAccept || "[\\d\\w]", "g");
			maskContainsAcceptChars = opts.mask.match(accept) || [];
		} catch (e) {
			console.error(`${opts.dataAccept} is not a valid regex.`, e);
			maskContainsAcceptChars = opts.mask.match(new RegExp("[\\d\\w]", "g"));
		}
		// const accept = new RegExp(opts.dataAccept || "[\\d\\w]", "g");
		if (maskContainsAcceptChars && maskContainsAcceptChars.length > 0)
			console.error(
				`${prefix} The 'mask' contains characters that are also able to be typed into the input, please fix the mask or add/correct the 'dataAccept' property to fix this issue`
			);
	}

	return "success";
}

function onSubmit(ev: any) {
	const form = ev.target;

	checkAll(ev.target);
	const isValid = form.checkValidity();
	if (!isValid) return ev.preventDefault();
	// return isValid;
	// if (isValid) alert("Form is Valid!");
	// ev.preventDefault();
}

function resetInput(inputElm: any) {
	setTimeout(() => {
		inputElm.failedRequiredValidationOnce = false;
		inputElm.requiredValidationActive = false;
		if (inputElm.mask) inputElm.unmaskedValue = "";
		inputElm.value = "";
		inputElm.originalValue = "";
	}, 0);
}

function onBlur(ev: any) {
	const opts = inputElms.get(ev.target);
	if (!opts.mask && opts.clickToViewIfRedacted) opts.setInputType?.("password");
	if (!opts.mask && opts.maskHideSecretOnBlur) opts.setInputType?.("password");

	const inputElm = ev.target;
	if (requiredValidationActive(inputElm)) return reportRequired(inputElm);
	if (getValue(inputElm) === "") return clearValidationError(inputElm);
	if (inputContainsUnacceptedChars(inputElm))
		return reportPatternNotValid(inputElm);
	if (inputNotLongEnough(inputElm)) return reportNotLongEnough(inputElm);
	if (inputLengthTooLong(inputElm)) return reportLengthTooLong(inputElm);
	if (patternNotValid(inputElm)) return reportPatternNotValid(inputElm);
	if (customNotValid(inputElm)) return reportCustomNotValid(inputElm);
	if (nativeNotValid(inputElm)) return reportNativeNotValid(inputElm);
	clearValidationError(inputElm);
}

function onKeyDown(ev: any) {
	const inputElm = ev.target;
	const opts = inputElms.get(inputElm);
	if (opts.mask) return; // the mask handles what data to accept, no need to do it here;
	if (!opts.dataAccept) return; // only intercept if dataAccept is explicitly set
	if (opts.allowUnacceptedChars) return;
	const allowedKeys = ["Backspace", "Tab", "ArrowRight", "ArrowLeft"];
	if (allowedKeys.includes(ev.key)) return;
	if (
		ev.key === "Control" ||
		ev.key === "Meta" ||
		ev.key === "Alt" ||
		ev.key === "Shift"
	)
		return;

	const accept = new RegExp(opts.dataAccept);
	const keyNotAccepted = !accept.test(ev.key);
	if (keyNotAccepted) {
		shakeInput(inputElm);
		return ev.preventDefault();
	}
}

function onInput(ev: any) {
	const inputElm = ev.target;
	const opts = inputElms.get(inputElm);

	if (!opts.mask && opts.clickToViewIfRedacted) {
		setTimeout(() => {
			opts.setInputType?.("password");
			inputElm.value = "REDACTED";
		}, 0);
		return;
	}

	if (!opts.validateOnInput && inputElm.checkValidity()) return;
	if (requiredValidationActive(inputElm)) return reportRequired(inputElm);
	if (getValue(inputElm) === "") return clearValidationError(inputElm);
	if (inputContainsUnacceptedChars(inputElm))
		return reportPatternNotValid(inputElm);
	if (inputNotLongEnough(inputElm)) return;
	if (inputLengthTooLong(inputElm)) return reportLengthTooLong(inputElm);
	if (patternNotValid(inputElm)) return reportPatternNotValid(inputElm);
	if (customNotValid(inputElm)) return reportCustomNotValid(inputElm);
	clearValidationError(inputElm);
}

function checkAll(formElm: any) {
	const allInputs = Array.from(formElm.querySelectorAll("input"));
	allInputs.forEach((inputElm) => {
		const opts = inputElms.get(inputElm);
		if (!opts) return;
		if (isRequired(inputElm)) return reportRequired(inputElm);
		if (inputContainsUnacceptedChars(inputElm))
			return reportPatternNotValid(inputElm);
		if (inputNotLongEnough(inputElm)) return reportNotLongEnough(inputElm);
		if (inputLengthTooLong(inputElm)) return reportLengthTooLong(inputElm);
		if (patternNotValid(inputElm)) return reportPatternNotValid(inputElm);
		if (customNotValid(inputElm)) return reportCustomNotValid(inputElm);
		if (nativeNotValid(inputElm)) return reportNativeNotValid(inputElm);
		clearValidationError(inputElm);
	});
}

function getValue(inputElm: any) {
	const opts = inputElms.get(inputElm);

	const unmaskedValue =
		typeof inputElm.unmaskedValue === "string"
			? inputElm.unmaskedValue
			: inputElm.value;

	const maskedValue =
		typeof inputElm.maskedValue === "string"
			? inputElm.maskedValue
			: inputElm.value;

	if (inputElm.type === "password") return maskedValue;

	return opts.validateUnMaskedValue ? unmaskedValue : maskedValue;
}

function isRequired(inputElm: any) {
	const opts = inputElms.get(inputElm);
	if (!opts.required) return false;
	const inputVal = inputElm.value;
	if (typeof opts.required === "function") {
		return opts.required(inputVal);
	}
	if (typeof inputVal === "string" && inputVal.trim().length === 0) return true;
	if (Array.isArray(inputVal) && inputVal.length === 0) return true;
	if (inputVal === "") return true;
	if (inputVal === null) return true;
	if (inputVal === undefined) return true;
	return false;
}

function reportRequired(inputElm: any) {
	const opts = inputElms.get(inputElm);
	const customMsg = opts.customErrorMessages.isRequired;

	inputElm.requiredValidationActive = true;
	inputElm.failedRequiredValidationOnce = true;
	const label =
		(inputElm.labels && inputElm.labels[0]?.textContent) || "This field";
	const msg = `${label} is required.`;

	if (customMsg) return setErrorMessage(inputElm, customMsg);
	setErrorMessage(inputElm, msg);
}

function requiredValidationActive(inputElm: any) {
	if (!inputElm.failedRequiredValidationOnce) return false;
	const opts = inputElms.get(inputElm);
	const inputVal = inputElm.value;
	if (typeof opts.required === "function" && opts.required(inputVal)) {
		return true;
	} else if (inputVal.length < 1) return true;

	if (!inputElm.requiredValidationActive) return false;
	inputElm.requiredValidationActive = false;
	clearValidationError(inputElm);
	return false;
}

function inputContainsUnacceptedChars(inputElm: any) {
	if (inputElm.type === "password") return false;
	const opts = inputElms.get(inputElm);
	const formattedNumber = opts.formatNumber === true;
	if (!opts.dataAccept) return false;
	const valSplit = getValue(inputElm).split("");
	const accept = new RegExp(opts.dataAccept);

	for (const char of valSplit) {
		const keyNotAccepted = !accept.test(char);
		const commaInFormattedNumber = formattedNumber && char === ",";
		if (commaInFormattedNumber) continue;
		if (keyNotAccepted) return true;
	}

	if (inputElm.patternValidationActive) clearValidationError(inputElm);
	inputElm.patternValidationActive = false;
	return false;
}

function inputNotLongEnough(inputElm: any) {
	const opts = inputElms.get(inputElm);
	if (!opts.minLength && !opts.exactLength) return false;

	const inpVal = getValue(inputElm);

	const tooLongActive = inputElm.inputTooLongErrorActive;
	const maxLen = opts.maxLength || opts.exactLength;
	if (tooLongActive && inpVal.length <= maxLen) {
		inputElm.inputTooLongErrorActive = false;
		clearValidationError(inputElm);
	}

	if (opts.minLength && inpVal.length < opts.minLength) return true;

	if (opts.exactLength && inpVal.length < opts.exactLength) return true;

	return false;
}

function reportNotLongEnough(inputElm: any) {
	const opts = inputElms.get(inputElm);
	const customMsg = opts.customErrorMessages.inputNotLongEnough;

	const label =
		(inputElm.labels && inputElm.labels[0]?.textContent) || "This field";
	const n = opts.minLength;
	const x = opts.exactLength;
	const m = opts.maxLength;
	const exact = opts.exactLength || m === n;
	const exactOrAtleast = exact ? "exactly" : "atleast";
	const chars = opts.isNumeric ? "digits" : "characters";
	const msg = `${label} must be ${exactOrAtleast} ${n || x} ${chars} long.`;

	if (customMsg) return setErrorMessage(inputElm, customMsg);
	setErrorMessage(inputElm, msg);
}

function inputLengthTooLong(inputElm: any) {
	const opts = inputElms.get(inputElm);
	const maxLen = opts.maxLength || opts.exactLength;
	if (!maxLen) return false;

	const inpVal = getValue(inputElm);
	if (inpVal.length > maxLen) {
		inputElm.inputTooLongErrorActive = true;
		return true;
	}

	return false;
}

function reportLengthTooLong(inputElm: any) {
	const opts = inputElms.get(inputElm);
	if (opts.exactLength) return reportNotLongEnough(inputElm);
	const maxLen = opts.maxLength;
	const customMsg = opts.customErrorMessages.inputLengthTooLong;

	const label =
		(inputElm.labels && inputElm.labels[0]?.textContent) || "This field";
	const chars = opts.isNumeric ? "digits" : "characters";
	const msg = `${label} must not be longer than ${maxLen} ${chars}.`;

	if (customMsg) return setErrorMessage(inputElm, customMsg);
	setErrorMessage(inputElm, msg);
}

function patternNotValid(inputElm: any) {
	const opts = inputElms.get(inputElm);
	if (!opts.pattern) return false;
	const val = inputElm.value;
	const re = new RegExp(opts.pattern);
	return !re.test(val);
}

function reportPatternNotValid(inputElm: any) {
	const opts = inputElms.get(inputElm);
	if (opts.clickToViewIfRedacted) return;
	const customMsg = opts.customErrorMessages.patternNotValid;

	inputElm.patternValidationActive = true;
	const label =
		(inputElm.labels && inputElm.labels[0]?.textContent) || "This field";
	const msg = `${label} is not valid.`;

	if (customMsg) return setErrorMessage(inputElm, customMsg);
	setErrorMessage(inputElm, msg);
}

function customNotValid(inputElm: any) {
	const opts = inputElms.get(inputElm);
	if (!opts.customValidator) return false;

	const test = opts.customValidator(getValue(inputElm));
	if (typeof test === "string") {
		opts.customErrorMessages.customNotValid = test;
		return true; //input is not valid is true
	}
	return !test;
}

function reportCustomNotValid(inputElm: any) {
	const opts = inputElms.get(inputElm);

	const customMsg = opts.customErrorMessages.customNotValid;

	const label =
		(inputElm.labels && inputElm.labels[0]?.textContent) || "This field";
	const msg = `${label} is not valid.`;

	if (customMsg) return setErrorMessage(inputElm, customMsg);
	setErrorMessage(inputElm, msg);
}

function nativeNotValid(inputElm: any) {
	return !inputElm.checkValidity();
}

function reportNativeNotValid(inputElm: any) {
	const opts = inputElms.get(inputElm);

	const customMsg = opts.customErrorMessages.nativeNotValid;
	if (inputElm.validationMessage)
		return setErrorMessage(inputElm, inputElm.validationMessage, true);

	const label =
		(inputElm.labels && inputElm.labels[0]?.textContent) || "This field";
	const msg = `${label} is not valid.`;

	if (customMsg) return setErrorMessage(inputElm, customMsg);
	setErrorMessage(inputElm, msg);
}

function openErrorElm(errorElm: any) {
	errorElm.style.height = errorElm.children[0].scrollHeight + "px";
}

function closeErrorElm(errorElm: any) {
	errorElm.style.height = "0px";
}

function clearValidationError(inputElm: any, skipSet = false) {
	const currentErrorMsg = inputElm.validationMessage;
	inputElm.classList.remove("invalid");
	inputElm.setCustomValidity("");

	const errorElm = inputElm.errorElm;
	errorElm.errorObj.delete(currentErrorMsg);
	!skipSet && setErrorMessages(errorElm);
}

function setErrorMessage(inputElm: any, msg: any, native = false) {
	if (!native) {
		clearValidationError(inputElm, true);
		if (inputElm.validationMessage === msg) return;
	}

	inputElm.classList.add("invalid");
	inputElm.setCustomValidity(msg);

	const errorElm = inputElm.errorElm;
	errorElm.errorObj.set(msg, true);
	setErrorMessages(errorElm);
}

let showErrorDeBounce: any = null;
function setErrorMessages(errorElm: any) {
	let innerDiv = errorElm.children[0];
	if (!innerDiv) {
		innerDiv = document.createElement("div");
		errorElm.appendChild(innerDiv);
	}
	const currentMessage = errorElm.children[0].textContent;
	let messages = Array.from(errorElm.errorObj.keys()).join("\n");
	if (messages === currentMessage) return;

	innerDiv.textContent = messages;

	clearTimeout(showErrorDeBounce);
	showErrorDeBounce = setTimeout(showErrors, 100);
}

function showErrors() {
	const allErrorElms = Array.from(errorElms.keys());
	for (const errorElm of allErrorElms) {
		if (!errorElm) continue;
		if (errorElm.errorObj.size === 0) closeErrorElm(errorElm);
		if (errorElm.errorObj.size > 0) openErrorElm(errorElm);
	}
}

function createErrorElementForInput(inputElm: any) {
	const errorElm = document.createElement("div");
	errorElm.style.height = "0px";
	errorElm.style.overflow = "hidden";
	errorElm.style.transition = "all 300ms";
	errorElm.style.color = "red";
	errorElm.style.fontSize = "10pt";
	errorElm.style.marginBottom = "10px";
	errorElm.classList.add("error-message");
	inputElm.style.marginBottom = "0px";
	inputElm.after(errorElm);
	return errorElm;
}

function VMaskerSetupProperties(el: any, formatValue: any) {
	const valueProp = ObjectGetOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value"
	);
	const setVal = (newValue: any) => valueProp!.set!.call(el, newValue);
	const getVal = () => valueProp!.get!.call(el);

	ObjectDefineProperty(el, "value", {
		get: function () {
			const unmaskedValue =
				typeof el.unmaskedValue === "string" ? el.unmaskedValue : getVal();

			const maskedValue =
				typeof el.maskedValue === "string" ? el.maskedValue : getVal();

			if (el.type === "password") {
				return maskedValue;
			}

			return el.unmaskInputValueProp ? unmaskedValue : maskedValue;
		},
		set: function (newValue) {
			setVal(formatValue(newValue));
			const blurEv = new Event(blurEvent);
			el.dispatchEvent(blurEv);
		},
	});

	const storedValues: any = {
		mask: el.mask,
		maskSlots: el.maskSlots,
		noMaskTrim: el.noMaskTrim,
		dataAccept: el.dataAccept,
	};

	const maskGettersAndSetters = (prop: any) =>
		ObjectDefineProperty(el, prop, {
			get: () => storedValues[prop],
			set: (newValue) => {
				storedValues[prop] = newValue;
				// el.resetVars();
				el.value = el.value;
			},
		});

	const maskProps = ["mask", "maskSlots", "dataAccept", "noMaskTrim"];

	maskProps.forEach((prop) => maskGettersAndSetters(prop));

	return [getVal, setVal] as const;
}

function VMasker(el: any) {
	// el.resetVars = () => {
	//   pattern = el.mask || el.getAttribute("placeholder");
	//   slots = new Set(el.maskSlots || el.dataset.slots || "_");
	//   accept = new RegExp(el.dataAccept || el.dataset.accept || "[\\d\\w]", "g");

	//   prev = ((j) =>
	//     Array.from(pattern, (c, i) => (slots.has(c) ? (j = i + 1) : j)))(0);

	//   first = [...pattern].findIndex((c) => slots.has(c));
	// };

	// el.resetVars();

	const clean = (inputReceived: any, pattern: string) => {
		const isNum = typeof inputReceived === "number";
		inputReceived = isNum ? inputReceived.toString() : inputReceived;
		const slots = new Set(el.maskSlots || el.dataset.slots || "_");
		const accept = new RegExp(
			el.dataAccept || el.dataset.accept || "[\\d\\w]",
			"g"
		);

		const unmaskedInput = inputReceived.match(accept) || [];
		const cleanInput = Array.from(pattern, (maskChar) =>
			unmaskedInput[0] === maskChar || slots.has(maskChar)
				? unmaskedInput.shift() || maskChar
				: maskChar
		);
		return cleanInput;
	};

	const formatValue = (value: any, skipRedactedCheck = false) => {
		const isNum = typeof value === "number";
		value = isNum ? value.toString() : value;

		const _pattern = el.mask || el.getAttribute("placeholder");
		const isFunc = typeof _pattern === "function";
		const pattern = isFunc ? _pattern(value) : _pattern;

		if (el.clickToViewIfRedacted && !skipRedactedCheck) {
			el.setInputType?.("password");
			clean(value, pattern);
			return value;
		}
		const slots = new Set(el.maskSlots || el.dataset.slots || "_");
		const fullMaskValue = clean(value, pattern);
		const newFirstSlot = fullMaskValue.findIndex((c) => slots.has(c));
		const showFullMask = el.showFullMaskWhileTyping || newFirstSlot === -1;
		const inputHasFocus = document.activeElement === el;
		const partialMaskValue =
			newFirstSlot === -1
				? fullMaskValue
				: fullMaskValue.slice(0, newFirstSlot);

		const newVal =
			showFullMask && inputHasFocus ? fullMaskValue : partialMaskValue;
		const slotsToHide = el.hideDotSlots && slots.has(".") ? "." : "";

		if (el.noMaskTrim) {
			const maskedValue = newVal.join("").replaceAll(slotsToHide, "");
			el.fullMaskValue = fullMaskValue.join("").replaceAll(slotsToHide, "");
			el.partialMaskValue = partialMaskValue
				.join("")
				.replaceAll(slotsToHide, "");
			el.maskedValue = maskedValue;
			return maskedValue;
		} else {
			const maskedValue = newVal.join("").replaceAll(slotsToHide, "").trim();
			el.fullMaskValue = fullMaskValue
				.join("")
				.replaceAll(slotsToHide, "")
				.trim();
			el.partialMaskValue = partialMaskValue
				.join("")
				.replaceAll(slotsToHide, "")
				.trim();
			el.maskedValue = maskedValue;
			return maskedValue;
		}
	};

	const [getVal, setVal] = VMaskerSetupProperties(el, formatValue);

	const format = () => {
		if (el.clickToViewIfRedacted) {
			el.setInputType?.("password");
			setVal("REDACTED");
			return;
		}

		const _pattern = el.mask || el.getAttribute("placeholder");
		const isFunc = typeof _pattern === "function";
		const pattern = isFunc ? _pattern(getVal()) : _pattern;

		const slots = new Set(el.maskSlots || el.dataset.slots || "_");
		const prev = ((j) =>
			Array.from(pattern, (c, i) => (slots.has(c) ? (j = i + 1) : j)))(0);
		const first = [...pattern].findIndex((c) => slots.has(c));
		const [i, j] = [el.selectionStart, el.selectionEnd].map((i) => {
			i = clean(getVal().slice(0, i), pattern).findIndex((c) => slots.has(c));
			const test =
				i < 0 ? prev[prev.length - 1] : back ? prev[i - 1] || first : i;
			return test;
		});

		const currentValue = getVal();
		const last = currentValue.at(-1);
		const len = currentValue.length;

		const accept = new RegExp(
			el.dataAccept || el.dataset.accept || "[\\d\\w]",
			"g"
		);

		if (i + 1 === len && j + 1 === len && last === ".") {
			const formatted = formatValue(getVal().slice(0, len - 1));
			setVal(formatted);
			el.unmaskedValue = formatted.match(accept)?.join("") || "";
		} else {
			const formatted = formatValue(getVal());
			setVal(formatted);
			el.unmaskedValue = formatted.match(accept)?.join("") || "";
		}

		if (document.activeElement == el) el.setSelectionRange(i, j);
		back = false;
	};

	const checkClickToView = async () => {
		if (el.clickToViewIfRedacted) {
			const _results = el.clickToViewIfRedacted(getVal());
			let results;
			if (_results instanceof Promise) {
				results = await _results;
			} else {
				results = _results;
			}

			if (!results) return;
			if (results === true) setVal(formatValue("", true));
			if (typeof results === "string") setVal(formatValue(results, true));
			setTimeout(() => {
				el.setInputType?.("text");
				el.focus();
			}, 0);
			return;
		}
	};

	const focusFormat = () => {
		if (el.clickToViewIfRedacted) return;
		if (el.maskHideSecretOnBlur) {
			el.setInputType?.("text");
		}
		const _pattern = el.mask || el.getAttribute("placeholder");
		const isFunc = typeof _pattern === "function";
		const pattern = isFunc ? _pattern(getVal()) : _pattern;

		const slots = new Set(el.maskSlots || el.dataset.slots || "_");
		const prev = ((j) =>
			Array.from(pattern, (c, i) => (slots.has(c) ? (j = i + 1) : j)))(0);
		const first = [...pattern].findIndex((c) => slots.has(c));
		setVal(formatValue(getVal()));
		setTimeout(() => {
			const [i, j] = [el.selectionStart, el.selectionEnd].map((i) => {
				i = clean(getVal().slice(0, i), pattern).findIndex((c) => slots.has(c));
				const test =
					i < 0 ? prev[prev.length - 1] : back ? prev[i - 1] || first : i;
				return test;
			});
			if (document.activeElement == el) el.setSelectionRange(i, j);
			back = false;
		}, 100);
	};

	let back = false;

	if (el.alreadyMasked) return;
	addEventListener(
		el,
		keyDownEvent,
		(e: any) => {
			back = e.key === "Backspace";
			const allowedKeys = ["Backspace", "Tab", "ArrowRight", "ArrowLeft"];
			if (allowedKeys.includes(e.key)) return;
			if (
				e.key === "Control" ||
				e.key === "Meta" ||
				e.key === "Alt" ||
				e.key === "Shift"
			)
				return;

			const accept = new RegExp(el.dataAccept);
			const keyNotAccepted = !accept.test(e.key);
			if (keyNotAccepted) {
				shakeInput(el);
			}
		},
		true
	);
	addEventListener(el, inputEvent, format, true);
	addEventListener(el, focusEvent, focusFormat, true);
	addEventListener(el, clickEvent, focusFormat, true);
	addEventListener(el, clickEvent, checkClickToView);
	addEventListener(
		el,
		blurEvent,
		() => {
			if (el.clickToViewIfRedacted) el.setInputType?.("password");
			const isFunc = typeof el.mask === "function";
			const pattern = isFunc ? el.mask(getVal()) : el.mask;

			if (pattern.startsWith(getVal())) {
				setVal("");
			} else {
				if (el.maskHideSecretOnBlur) el.setInputType?.("password");
			}
		},
		true
	);

	// mask any default values already set in the input
	el.value = el.value;

	el.alreadyMasked = true;
}

export { setupValidatorInput };

export type { ValidatorOptions };
