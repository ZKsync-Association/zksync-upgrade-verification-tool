import NavbarWithUser from "@/components/navbar-with-user";
import { getUserFromHeader } from "@/utils/auth-headers";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";

export function loader({ request }: LoaderFunctionArgs) {
  return { user: getUserFromHeader(request) };
}

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <>
      {user && <NavbarWithUser role={user.role} />}
      <div className="flex w-full flex-1 flex-col">
        <img
          className="-z-10 absolute top-0 left-0"
          src="/graphics/blur-overlay.svg"
          alt="Blur overlay"
        />
        <div className="w-full text-center">
          <h1 className="pt-20 pb-14 font-bold text-3xl md:text-5xl">
            Upgrade Analysis & Approval Tool
          </h1>
        </div>
        <Outlet />
      </div>
    </>
  );
}