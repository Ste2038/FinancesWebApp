import { AccountRegistry } from "@/components/accounts/account-registry";
import { getAccountsList } from "@/lib/server/finance-data";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await getAccountsList();

  return <AccountRegistry accounts={accounts} />;
}
