import { signOut } from "@/auth"

export function SignOut() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut()
      }}
    >
      <button type="submit" className="text-red-600 hover:text-red-800">
        Sign Out
      </button>
    </form>
  )
}
