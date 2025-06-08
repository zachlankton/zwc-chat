import { getObjVal, setObjVal } from "./objectFromPathString";

function getFormData(form: any): any {
	const namedElements = Array.from(
		form.querySelectorAll("[name]")
	) as HTMLInputElement[];
	const return_data = {};
	for (const elm of namedElements) {
		const path = elm.getAttribute("name") || "";
		const { val, skip } = getValue(elm);
		if (skip) continue;
		setObjVal(return_data, path, val);
	}
	return return_data;
}

export function getBooleanValue(val: any) {
	if (typeof val === "boolean") return val;
	if (typeof val === "string") return val.toLowerCase() === "true";
	return !!val;
}

function getValue(elm: HTMLInputElement) {
	if (elm.type === "text" && elm.dataset.object)
		return { val: (elm as any).objectRef ?? null };
	if (elm.type === "radio" && elm.checked) return { val: elm.id || elm.value };
	if (elm.type === "radio" && !elm.checked) return { skip: true };
	if (elm.type === "checkbox") return { val: elm.checked };
	if (elm.type === "number" || elm.dataset.formatNumber === "true")
		return { val: Number(elm.value) };
	if (elm.value) return { val: elm.value };
	return { val: "" };
}

function setValue(elm: HTMLInputElement, val: any) {
	if (!elm.name) return;
	const radioVal = elm.id || elm.value;
	if (elm.type === "text" && elm.dataset.object)
		return ((elm as any).objectRef = val);
	if (elm.type === "radio" && val === radioVal) return (elm.checked = true);
	if (elm.type === "radio" && val !== radioVal) return (elm.checked = false);
	if (elm.type === "checkbox") return (elm.checked = getBooleanValue(val));
	elm.value = val;
}

interface setFormDataOptions {
	skipChangeEvent?: boolean;
	skipUnsetProperties?: boolean;
}

function setFormData(form: any, data: any, opts: setFormDataOptions = {}) {
	const namedElements = Array.from(
		form.querySelectorAll("[name]")
	) as HTMLInputElement[];
	for (const elm of namedElements) {
		const path = elm.getAttribute("name") || "";
		const val = getObjVal(data, path);

		if (opts.skipUnsetProperties && (val === null || val === undefined))
			continue;

		if (
			(elm as any).originalValue !== undefined &&
			(elm as any).originalValue === val &&
			(elm as any).value === val
		)
			continue;

		setValue(elm, val ?? "");

		(elm as any)._zSourceData = data;
		(elm as any)._zPath = path;
		(elm as any)._zSetSourceVal = (newVal: any) =>
			setObjVal((elm as any)._zSourceData, (elm as any)._zPath, newVal);

		(elm as any).originalValue = val;
		const evtInput = new Event("input", { bubbles: true });
		const evtChange = new Event("change", { bubbles: true });

		if (!opts.skipChangeEvent) {
			elm.dispatchEvent(evtInput);
			setTimeout(() => {
				elm.dispatchEvent(evtChange);
			}, 0);
		}
	}
}

// eslint-disable-next-line import/no-unused-modules
export { getFormData, setFormData };
