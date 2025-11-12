import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainScreen } from "@/components/screens/MainScreen";
import { Screen2 } from "@/components/screens/Screen2";
import { Screen3 } from "@/components/screens/Screen3";
import { Screen4 } from "@/components/screens/Screen4";
import { Screen5 } from "@/components/screens/Screen5";
import { Screen6 } from "@/components/screens/Screen6";
import { Screen7 } from "@/components/screens/Screen7";
import { Sparkles } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("main");
  const [mainResponse, setMainResponse] = useState(null);
  const [mainLoading, setMainLoading] = useState(false);
  const [mainDone, setMainDone] = useState(false);

  const [screen2Response, setScreen2Response] = useState(null);
  const [screen2FormData, setScreen2FormData] = useState({productUrl: "", winningAngle: "", ctaHook: ""});
  const [screen2Loading, setScreen2Loading] = useState(false);
  const [screen2Done, setScreen2Done] = useState(false);
  
  const [screen3Response, setScreen3Response] = useState(null);
  const [screen4Response, setScreen4Response] = useState(null);
  const [screen5Response, setScreen5Response] = useState(null);
  const [screen6Response, setScreen6Response] = useState(null);
  const [screen7Response, setScreen7Response] = useState(null);

  // Shared data from MainScreen → Screen2
  const [sharedData, setSharedData] = useState({});
  const [sharedDataForScreen3, setSharedDataForScreen3] = useState({});
  const [sharedDataForScreen4, setSharedDataForScreen4] = useState({});
  const [sharedDataForScreen5, setSharedDataForScreen5] = useState({});
  const [sharedDataForScreen6, setSharedDataForScreen6] = useState({});
  const [sharedDataForScreen4From7, setSharedDataForScreen4From7] = useState({});

  // *** FIX PART 1: Add this function to clear the shared state ***
  const clearSharedDataForScreen3 = () => {
    setSharedDataForScreen3({});
  };

  // *** FIX PART 1: Add a clearing function for Screen 4's data ***
  const clearSharedDataForScreen4 = () => {
    setSharedDataForScreen4({});
  };

  // *** FIX PART 1: Add a clearing function for Screen 5's data ***
  const clearSharedDataForScreen5 = () => {
    setSharedDataForScreen5({});
  };

  const clearSharedDataForScreen4From7 = () => {
    setSharedDataForScreen4From7({});
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header style={{ left: "30px" }}
        className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          width: "100%"
        }}>
          {/* Left Section: Logo and Title */}
          <div className="flex items-center gap-3" style={{ marginLeft: "30px" }}>
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                AI Marketing Engine
              </h1>
              <p className="text-sm text-muted-foreground">
                Professional marketing content creation toolkit
              </p>
            </div>
          </div>

          {/* Right Section: Logout button */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "15px 70px",
              background: "linear-gradient(to right, #3b82f6, #6366f1)",
              color: "white",
              fontWeight: "600",
              borderRadius: "9999px",
              border: "none",
              boxShadow: "0 4px 6px rgba(171, 9, 9, 0.1)",
              transition: "all 0.3s",
              cursor: "pointer",
              marginRight: "30px",
            }}
            onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
            onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            onClick={handleLogout}
          >
            Logout
          </button>
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
                onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
                onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
              >Hook and CTA</TabsTrigger>
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
                onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
                onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
              >AIDA Script</TabsTrigger>
              <TabsTrigger 
                value="screen7" 
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
                  outline: "none" 
                }} 
                className="data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 hover:brightness-105">
                Hook to Image</TabsTrigger>
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
                onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
                onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
              >
                Images/Voice
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
              onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
              onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              Images to videos
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
              onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
              onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              Text to video
            </TabsTrigger>
            <TabsTrigger
              value="screen6"
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
              onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
              onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              Image to Multiple videos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="main" className="mt-0">
            <MainScreen response={mainResponse} setResponse={setMainResponse} loading={mainLoading} setLoading={setMainLoading} done={mainDone} setDone={setMainDone} setActiveTab={setActiveTab} setSharedData={setSharedData}/>
          </TabsContent>

          <TabsContent value="screen2" className="mt-0">
            <Screen2 response={screen2Response} setResponse={setScreen2Response} setActiveTab={setActiveTab} sharedData={sharedData} setSharedDataForScreen3={setSharedDataForScreen3} setSharedDataForScreen5={setSharedDataForScreen5} />
          </TabsContent>

          <TabsContent value="screen7" className="mt-0">
            <Screen7 
              response={screen7Response} 
              setResponse={setScreen7Response} 
              setActiveTab={setActiveTab} 
              setSharedDataForScreen4={setSharedDataForScreen4From7} 
            />
          </TabsContent>

          <TabsContent value="screen3" className="mt-0">
            <Screen3 response={screen3Response} setResponse={setScreen3Response} setActiveTab={setActiveTab} sharedData={sharedDataForScreen3} setSharedDataForScreen4={setSharedDataForScreen4} clearSharedData={clearSharedDataForScreen3}/>
          </TabsContent>

          <TabsContent value="screen4" className="mt-0">
            <Screen4 
              response={screen4Response} 
              setResponse={setScreen4Response} 
              setActiveTab={setActiveTab} 
              sharedData={{ ...sharedDataForScreen4, ...sharedDataForScreen4From7 }} 
              setSharedDataForScreen5={setSharedDataForScreen5} 
              clearSharedData={clearSharedDataForScreen4}
              clearSharedDataFrom7={clearSharedDataForScreen4From7}
            />
          </TabsContent>


          <TabsContent value="screen5" className="mt-0">
            <Screen5 response={screen5Response} setResponse={setScreen5Response} setActiveTab={setActiveTab} sharedData={sharedDataForScreen5} setSharedDataForScreen6={setSharedDataForScreen6} clearSharedData={clearSharedDataForScreen5}/>
          </TabsContent>

          <TabsContent value="screen6" className="mt-0">
            <Screen6 response={screen6Response} setActiveTab={setActiveTab} sharedDataForScreen6={sharedDataForScreen6} setSharedDataForScreen6={setSharedDataForScreen6}/>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
