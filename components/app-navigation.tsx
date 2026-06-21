"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppNavigationProps = {
  variant: "desktop" | "mobile";
};

const navigationItems = [
  { label: "Today", icon: "◉", href: "/" },
  { label: "Week", icon: "▦", href: "/week" },
  { label: "Recipes", icon: "▤", href: "/recipes" },
  { label: "Pantry", icon: "◫", href: "/pantry" },
  { label: "Shopping", icon: "✓", href: "/shopping" },
];

export default function AppNavigation({
  variant,
}: AppNavigationProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  if (variant === "desktop") {
    return (
      <nav className="desktop-navigation" aria-label="Main navigation">
        {navigationItems.map((item) => (
          <Link
            className={isActive(item.href) ? "nav-item active" : "nav-item"}
            href={item.href}
            key={item.href}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      {navigationItems.map((item) => (
        <Link
          className={
            isActive(item.href)
              ? "mobile-nav-item active"
              : "mobile-nav-item"
          }
          href={item.href}
          key={item.href}
        >
          <span aria-hidden="true">{item.icon}</span>
          <small>{item.label}</small>
        </Link>
      ))}
    </nav>
  );
}