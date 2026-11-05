import type { Metadata } from "next";
import AiProviderForm from "../_components/ai-provider-form";
import SiteFooter from "../_components/site-footer";
import SiteHeader from "../_components/site-header";

export const metadata: Metadata = {
  title: "AI provider",
  description:
    "Connect your own AI provider to Spend Audit. The base URL, key and model stay in this browser.",
};

export default function SettingsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader settingsActive />
      <AiProviderForm />
      <SiteFooter />
    </div>
  );
}
