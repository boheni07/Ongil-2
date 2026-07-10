export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 items-start justify-center bg-primary-50/40 px-4 py-10 dark:bg-black sm:py-16">
      {children}
    </div>
  );
}
