
export function GET() {
	return Response.json(
		{
			status: "ok",
			service: "fe-dacn-frontend",
		},
		{
			status: 200,
			headers: {
				"Cache-Control": "no-store",
			},
		},
	);
}