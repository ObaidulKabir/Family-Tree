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
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 text-center sm:px-10 lg:px-20">
        <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">
          Welcome to <span className="text-blue-600">Family Explorer</span>
        </h1>

        <p className="mt-3 text-lg sm:text-xl lg:text-2xl">
          Build and manage your family history with ease.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
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
          <Link
            href="/invite"
            className="px-6 py-3 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 text-lg font-medium"
          >
            Have an invite?
          </Link>
        </div>
      </main>
    </div>
  );
}
