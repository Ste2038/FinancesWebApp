"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navigation = [
  { href: "/" as Route, label: "Overview", shortLabel: "Home" },
  { href: "/accounts" as Route, label: "Accounts", shortLabel: "Accounts" },
  { href: "/categories" as Route, label: "Categories", shortLabel: "Categories" },
  { href: "/transactions" as Route, label: "Transactions", shortLabel: "Moves" },
  { href: "/analytics" as Route, label: "Analytics", shortLabel: "Charts" },
  { href: "/imports" as Route, label: "Imports", shortLabel: "Imports" },
  { href: "/settings" as Route, label: "Settings", shortLabel: "Settings" }
];

export function AppShell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__eyebrow">Personal Finance</span>
          <strong>Finances Web App</strong>
          <p>Track balances, reconcile phone exports, and expose a clean finance API for the UI and Telegram.</p>
        </div>

        <nav className="nav">
          {navigation.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                className={`nav__link${isActive ? " nav__link--active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <span className="nav__short">{item.shortLabel}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <span className="topbar__eyebrow">Status</span>
            <h1>Finance command center</h1>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
