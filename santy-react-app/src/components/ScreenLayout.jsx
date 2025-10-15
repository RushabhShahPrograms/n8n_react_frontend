import React from "react";
import { Card } from "@/components/ui/card";

export const ScreenLayout = ({ children, title }) => {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="font-bold bg-gradient-primary bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      <Card className="p-6 shadow-soft border-border/50">
        {children}
      </Card>
    </div>
  );
};

