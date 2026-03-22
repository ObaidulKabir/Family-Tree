import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold">
          Welcome to <span className="text-blue-600">Family Tree App</span>
        </h1>

        <p className="mt-3 text-2xl">
          Build and manage your family history with ease.
        </p>

        <div className="flex mt-6 gap-4">
          <Link
            href="/login"
            className="px-6 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 text-lg font-medium"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 text-lg font-medium"
          >
            Register
          </Link>
        </div>
      </main>
    </div>
  );
}
