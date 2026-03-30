"use client";

import { CircleMenu } from "@/components/ui/circle-menu";
import { Home, Gamepad2, Camera, Zap, Shield, User, Mail, Menu, X } from 'lucide-react';
import Link from "next/link";

export default function MenuPage() {
  return (
    <div className="w-full h-screen flex items-center justify-center mx-auto relative">
      {/* Back button */}
      <Link 
        href="/"
        className="absolute top-8 left-8 z-20 px-6 py-3 text-sm font-bold rounded-lg border-2 transition-all duration-300 hover:scale-105"
        style={{
          color: "#c41e3a",
          borderColor: "#c41e3a",
          background: "rgba(0,0,0,0.8)",
          boxShadow: "0 0 20px rgba(196,30,58,0.3)"
        }}
      >
        ← BACK TO HOME
      </Link>

      <CircleMenu
        items={[
          { label: 'Home', icon: <Home size={20} style={{ color: '#c41e3a' }} />, href: '/' },
          { label: 'Game', icon: <Gamepad2 size={20} style={{ color: '#0066cc' }} />, href: '/game' },
          { label: 'Spider-Sense', icon: <Camera size={20} style={{ color: '#c41e3a' }} />, href: '/' },
          { label: 'Powers', icon: <Zap size={20} style={{ color: '#0066cc' }} />, href: '/' },
          { label: 'Shield', icon: <Shield size={20} style={{ color: '#c41e3a' }} />, href: '/' },
          { label: 'Profile', icon: <User size={20} style={{ color: '#0066cc' }} />, href: '/' },
          { label: 'Contact', icon: <Mail size={20} style={{ color: '#c41e3a' }} />, href: '/' }
        ]}
        openIcon={<Menu size={20} style={{ color: 'white' }} />}
        closeIcon={<X size={20} style={{ color: 'white' }} />}
      />
      
      {/* Dotted background pattern */}
      <div
        className="absolute w-full h-full -z-10"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg width=\\'4\\' height=\\'4\\' viewBox=\\'0 0 6 6\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Ccircle cx=\\'6\\' cy=\\'6\\' r=\\'1\\' fill=\\'%23c41e3a\\' fill-opacity=\\'0.15\\' /%3E%3C/svg%3E')",
          backgroundColor: "#000000",
        }}
      />

      {/* Custom styles for Spider-Man theme */}
      <style jsx global>{`
        :root {
          --foreground: #c41e3a;
          --background: #000000;
          --muted: linear-gradient(135deg, #c41e3a 0%, #0066cc 100%);
        }
        
        .bg-muted {
          background: linear-gradient(135deg, #c41e3a 0%, #0066cc 100%);
          box-shadow: 0 0 20px rgba(196, 30, 58, 0.5);
        }
        
        .bg-muted:hover {
          background: linear-gradient(135deg, #0066cc 0%, #c41e3a 100%);
          box-shadow: 0 0 30px rgba(0, 102, 204, 0.7);
        }
        
        .bg-foreground {
          background: linear-gradient(135deg, #c41e3a 0%, #0066cc 100%);
          box-shadow: 0 0 30px rgba(196, 30, 58, 0.8);
        }
        
        .text-foreground {
          color: #c41e3a;
          font-weight: bold;
          text-shadow: 0 0 10px rgba(196, 30, 58, 0.5);
        }
      `}</style>
    </div>
  );
}
