import { HomeLink } from "@/components/home-link";

export default function SubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full">
      <header className="absolute top-4 left-5 z-10">
        <HomeLink />
      </header>
      {children}
    </div>
  );
}
