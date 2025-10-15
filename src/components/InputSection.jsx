import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const StyledInput = ({ field, value, onChange }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <input
      id={field.name}
      name={field.name}
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(field.name, e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={{
        width: "93%",
        height: "40px",
        fontSize: "0.9rem",
        backgroundColor: "var(--card, #fff)",
        border: isFocused ? "2px solid #8b5cf6" : "1px solid rgba(120,120,120,0.4)", // violet when focused
        borderRadius: "8px",
        padding: "0 10px",
        outline: "none",
        transition: "border 0.2s ease, box-shadow 0.2s ease",
        boxShadow: isFocused ? "0 0 6px rgba(139,92,246,0.4)" : "none",
      }}
    />
  );
};

export const InputSection = ({ title, fields, onChange, values = {} }) => {
  return (
    <Card className="p-6 bg-gradient-subtle border border-border/50 rounded-2xl shadow-sm">
      <h3 className="text-lg font-semibold mb-5 text-foreground tracking-wide">
        {title}
      </h3>

      <div className="space-y-6">
        {fields.map((field) => {
          const value = values[field.name] || "";
          return (
            <div key={field.name}>
              <Label
                htmlFor={field.name}
                className="block text-sm font-medium text-foreground mb-2"
                style={{ textAlign: "left" }}
              >
                {field.label}
              </Label>

              {field.type === "textarea" ? (
                <Textarea
                  id={field.name}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={value}
                  className="w-full min-h-[100px] text-sm bg-card border border-border/70 
                  focus:border-primary focus:ring-1 focus:ring-primary/40 
                  rounded-lg transition-all"
                  onChange={(e) => onChange(field.name, e.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  id={field.name}
                  name={field.name}
                  value={value}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="w-full h-10 text-sm bg-card border border-border/70 
                            focus:border-primary focus:ring-1 focus:ring-primary/40 
                            rounded-lg transition-all p-2 text-foreground cursor-pointer"
                              >
                  {field.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <StyledInput field={field} value={value} onChange={onChange} />
              )}
              
            </div>
          );
        })}
      </div>
    </Card>
  );
};
