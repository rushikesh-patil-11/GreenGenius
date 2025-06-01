import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Leaf, Sparkles, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useClerk } from "@clerk/clerk-react";

export default function Landing() {
  const { openSignIn } = useClerk();

  const handleGetStarted = () => {
    openSignIn({ afterSignInUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <section className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            AI-Powered
            <span className="text-primary block">Plant Care</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Transform your home into a thriving garden with intelligent plant
            management, and AI-driven
            recommendations.
          </p>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white text-lg px-8 py-6"
            onClick={handleGetStarted}
          >
            Get Started Free
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Everything You Need for Plant Success
            </h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive plant care management powered by artificial
              intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="plant-card">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-lg w-fit">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>
                  Get personalized care advice powered by advanced AI technology
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our AI analyzes your plants' needs and provides tailored
                  recommendations for optimal growth and health.
                </p>
              </CardContent>
            </Card>

            <Card className="plant-card">
              <CardHeader>
                <div className="bg-secondary/10 p-3 rounded-lg w-fit">
                  <Calendar className="h-8 w-8 text-secondary" />
                </div>
                <CardTitle>Smart Scheduling</CardTitle>
                <CardDescription>
                  Never miss watering or care tasks with intelligent reminders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Customized care based on each plant's specific
                  needs, season, and environmental conditions.
                </p>
              </CardContent>
            </Card>

            <Card className="plant-card">
              <CardHeader>
                <div className="bg-accent/10 p-3 rounded-lg w-fit">
                  <TrendingUp className="h-8 w-8 text-accent" />
                </div>
                <CardTitle>Growth Tracking</CardTitle>
                <CardDescription>
                  Monitor your plants' progress with detailed health insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track growth milestones, health status, and care history to
                  optimize your plant care routine.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="pt-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Ready to Transform Your Plant Care?
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Join thousands of plant enthusiasts who have revolutionized
                their gardening with AI-powered insights and smart care
                management.
              </p>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={handleGetStarted}
              >
                Start Your Plant Journey
                <Leaf className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">PlantCare Pro</span>
          </div>
          <p className="text-muted-foreground">
            AI-powered plant care management for the modern gardener
          </p>
        </div>
      </footer>
    </div>
  );
}
