import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainScreen } from "@/components/screens/MainScreen";
import { Screen2 } from "@/components/screens/Screen2";
import { Screen3 } from "@/components/screens/Screen3";
import { Screen4 } from "@/components/screens/Screen4";
// import { Screen5 } from "@/components/screens/Screen5";
import { Sparkles } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("main");
  const [mainResponse, setMainResponse] = useState(null);
  const [screen2Response, setScreen2Response] = useState(null);
  const [screen3Response, setScreen3Response] = useState(null);
  const [screen4Response, setScreen4Response] = useState(null);

  // Shared data from MainScreen → Screen2
  const [sharedData, setSharedData] = useState({});
  const [sharedDataForScreen3, setSharedDataForScreen3] = useState({});
  const [sharedDataForScreen4, setSharedDataForScreen4] = useState({});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                AI Content Generator
              </h1>
              <p className="text-sm text-muted-foreground">Professional content creation toolkit</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full mb-8 gap-3 overflow-x-auto" style={{ padding: "4px", borderRadius: "12px", background: "#f3f4f6" }}>
              <TabsTrigger
                value="main"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px 16px",
                  borderRadius: "9999px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: "linear-gradient(to right, #3b82f6, #6366f1)",
                  color: "white",
                  border: "none",
                  outline: "none",
                }}
                className="data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 hover:brightness-105"
              >Main Screen </TabsTrigger>
              <TabsTrigger
                value="screen2"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px 16px",
                  borderRadius: "9999px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: "linear-gradient(to right, #3b82f6, #6366f1)",
                  color: "white",
                  border: "none",
                  outline: "none",
                }}
                className="data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 hover:brightness-105"
              >Screen 2 </TabsTrigger>
              <TabsTrigger
                value="screen3"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px 16px",
                  borderRadius: "9999px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: "linear-gradient(to right, #3b82f6, #6366f1)",
                  color: "white",
                  border: "none",
                  outline: "none",
                }}
                className="data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 hover:brightness-105"
              >
                Screen 3
              </TabsTrigger>
            <TabsTrigger value="screen4"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "12px 16px",
                borderRadius: "9999px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.3s",
                background: "linear-gradient(to right, #3b82f6, #6366f1)",
                color: "white",
                border: "none",
                outline: "none",
              }}
              className="data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 hover:brightness-105"
            >
              Screen 4
            </TabsTrigger>
            <TabsTrigger
              value="screen5"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "12px 16px",
                borderRadius: "9999px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.3s",
                background: "linear-gradient(to right, #3b82f6, #6366f1)",
                color: "white",
                border: "none",
                outline: "none",
              }}
              className="data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 hover:brightness-105"
            >
              Screen 5
            </TabsTrigger>
          </TabsList>
          <TabsContent value="main" className="mt-0">
            <MainScreen response={mainResponse} setResponse={setMainResponse} setActiveTab={setActiveTab} setSharedData={setSharedData}/>
          </TabsContent>

          <TabsContent value="screen2" className="mt-0">
            <Screen2 response={screen2Response} setResponse={setScreen2Response} setActiveTab={setActiveTab} sharedData={sharedData} setSharedDataForScreen3={setSharedDataForScreen3} />
          </TabsContent>

          <TabsContent value="screen3" className="mt-0">
            <Screen3 response={screen3Response} setResponse={setScreen3Response} setActiveTab={setActiveTab} sharedData={sharedDataForScreen3} setSharedDataForScreen4={setSharedDataForScreen4}/>
          </TabsContent>

          <TabsContent value="screen4" className="mt-0">
            <Screen4 response={screen4Response} setResponse={setScreen4Response} sharedData={sharedDataForScreen4}/>
          </TabsContent>

          {/* <TabsContent value="screen5" className="mt-0">
            <Screen5 />
          </TabsContent> */}
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
