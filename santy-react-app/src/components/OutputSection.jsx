import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Download, Play } from "lucide-react";

export const OutputSection = ({ title, items, type }) => {
  return (
    <Card className="p-5 bg-gradient-subtle border-border/50">
      <h3 className="text-lg font-semibold mb-4 text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-4">
        {items && items.length > 0 ? (
          items.map((item) => (
            <Card key={item.id} className="overflow-hidden border-border/50 shadow-soft hover:shadow-medium transition-smooth">
              <div className="aspect-video bg-muted relative group">
                {type === "video" ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button size="icon" variant="outline" className="rounded-full">
                      <Play className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-primary opacity-10" />
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium truncate">{item.title}</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            No {type}s generated yet
          </div>
        )}
      </div>
    </Card>
  );
};
