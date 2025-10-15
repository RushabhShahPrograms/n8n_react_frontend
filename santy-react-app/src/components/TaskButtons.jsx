import React from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ImageIcon, Video, Wand2 } from "lucide-react";

export const TaskButtons = ({ onTaskSelect }) => {
  const tasks = [
    { id: "product-script", label: "Product Image and Script", icon: ImageIcon },
    { id: "image-audio", label: "Image Gen & Audio", icon: Wand2 },
    { id: "images-video", label: "Images to Video", icon: Video },
  ];

  return (
    <Card className="p-5 bg-gradient-subtle border-border/50">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Different Tasks</h3>
      <div className="grid grid-cols-1 gap-3">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <Button
              key={task.id}
              variant="outline"
              className="justify-start h-auto py-4 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-smooth"
              onClick={() => onTaskSelect && onTaskSelect(task.id)}
            >
              <Icon className="h-5 w-5 mr-3" />
              <span className="font-medium">{task.label}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
};
