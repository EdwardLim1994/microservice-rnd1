import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { Test1Page } from "./modules/test1";

const rootRoute = createRootRoute({
	component: () => (
		<div className="h-screen w-full">
			<Test1Page />
		</div>
	),
});

const routeTree = rootRoute.addChildren([]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
