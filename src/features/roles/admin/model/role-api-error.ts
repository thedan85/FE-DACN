import { ApiError } from "@/lib/api/client";
export { describeAdminApiFailure as describeRoleApiFailure } from "@/lib/api/admin-api-error";

type FieldName = "code" | "name" | "description";
export function roleFormFailure(caught: ApiError, operation: "create" | "update") {
	const fields: Array<{ name: FieldName; errors: string[] }> = [];
	if (operation === "create" && caught.status === 409) {
		return { fields: [{ name: "code" as const, errors: [caught.message] }], alert: null };
	}
	const unparsed: string[] = [];
	for (const segment of caught.message.split(";").map((part) => part.trim()).filter(Boolean)) {
		const match = /^(code|name|description):\s*(.+)$/.exec(segment);
		if (match) {
			fields.push({ name: match[1] as FieldName, errors: [match[2]] });
		} else if (operation === "update" && /^name\b/i.test(segment)) {
			fields.push({ name: "name", errors: [segment] });
		} else unparsed.push(segment);
	}
	return { fields, alert: unparsed.length ? unparsed.join("; ") : fields.length === 0 ? `We couldn't ${operation === "create" ? "create" : "update"} this role. Correct the fields below.` : null };
}

export function isPermissionNotFound(caught: unknown) {
	return caught instanceof ApiError && caught.status === 404 && /^permission not found:/i.test(caught.message.trim());
}
