import HomeScreen from "./_components/home-screen";
import SiteFooter from "./_components/site-footer";
import SiteHeader from "./_components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <HomeScreen />
      <SiteFooter />
    </div>
  );
}
