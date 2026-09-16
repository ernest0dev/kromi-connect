import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { Features } from "@/components/Features";
import { SLAFlow } from "@/components/SLAFlow";
import { Stack } from "@/components/Stack";
import { CTAFinal } from "@/components/CTAFinal";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Problem />
      <Features />
      <SLAFlow />
      <Stack />
      <CTAFinal />
      <Footer />
    </>
  );
}
