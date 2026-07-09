import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Palette, Type, Layout, FileDown, Upload, RotateCcw, AlertTriangle, ImagePlay } from "lucide-react";
import { ThemeConfig, defaultTheme, normalizeTheme } from "@/lib/theme";
import { BackgroundMediaCustomizer } from "@/components/BackgroundMediaCustomizer";
import { commitPendingTheme, parseImportedTheme, prepareThemeExport } from "./theme-save-state";

interface ThemeCustomizerProps {
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>; // Persist to backend
  onThemePreview?: (theme: ThemeConfig) => void; // Live apply in admin without saving
}

export const ThemeCustomizer = ({ theme, onThemeChange, onThemePreview }: ThemeCustomizerProps) => {
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [pendingTheme, setPendingTheme] = useState<ThemeConfig>(theme);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Sync pendingTheme with theme prop when it changes
  useEffect(() => {
    setPendingTheme(theme);
    setIsDirty(false);
    setSaveError("");
    setSaveState("idle");
  }, [theme]);
  
  const updatePendingTheme = (updates: Partial<ThemeConfig>) => {
    const newTheme = { ...pendingTheme, ...updates } as ThemeConfig;
    setPendingTheme(newTheme);
    setIsDirty(true);
    setSaveError("");
    setSaveState("idle");
    // Live preview in admin without persisting
    onThemePreview?.(newTheme);
  };

  const saveTheme = async () => {
    if (!isDirty) return;
    setSaveState("saving");
    setSaveError("");
    const result = await commitPendingTheme({
      isDirty,
      theme: pendingTheme,
      onSave: onThemeChange,
    });

    setIsDirty(result.isDirty);
    setSaveError(result.error);
    if (result.saved) {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } else if (result.error) {
      setSaveState("error");
    } else {
      setSaveState("idle");
    }
  };

  const ColorPicker = ({ 
    label, 
    value, 
    onChange, 
    id 
  }: { 
    label: string; 
    value: string; 
    onChange: (color: string) => void;
    id: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <div
          className="w-8 h-8 rounded border-2 border-border cursor-pointer transition-all hover:scale-110"
          style={{ backgroundColor: value }}
          onClick={() => setActiveColorPicker(activeColorPicker === id ? null : id)}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
          placeholder="#000000"
        />
      </div>
      {activeColorPicker === id && (
        <div className="absolute z-50 mt-2">
          <div 
            className="fixed inset-0" 
            onClick={() => setActiveColorPicker(null)}
          />
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );

  const exportTheme = () => {
    const dataStr = prepareThemeExport(pendingTheme);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mylinks-theme.json';
    link.click();
  };

  const importTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseImportedTheme(e.target?.result as string, normalizeTheme);
        setPendingTheme(result.theme);
        setIsDirty(result.isDirty);
        setSaveError(result.error);
        setSaveState("idle");
        onThemePreview?.(result.theme);
      } catch (error) {
        console.error('Failed to import theme:', error);
        setSaveError("Theme import failed. Choose a valid JSON theme file.");
        setSaveState("error");
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-imported if needed
    event.target.value = '';
  };

  const resetTheme = () => {
    setPendingTheme(defaultTheme);
    setIsDirty(true);
    setSaveError("");
    setSaveState("idle");
    onThemePreview?.(defaultTheme);
  };

  return (
    <Card className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Theme Customizer</h2>
          {isDirty && <span className="admin-dirty-badge">Unsaved changes</span>}
        </div>
        <div className="flex gap-2">
          <Button onClick={saveTheme} size="sm" disabled={!isDirty || saveState === "saving"}>
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save Changes"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportTheme}>
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={importTheme}
                className="hidden"
              />
            </label>
          </Button>
          <Button variant="destructive" size="sm" onClick={resetTheme}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {saveState === "saved" && (
        <div className="admin-save-confirmation admin-save-confirmation-success" role="status" aria-live="polite">
          <CheckCircle className="h-4 w-4" />
          <span>Theme saved successfully.</span>
        </div>
      )}

      {saveState === "error" && (
        <div className="admin-save-confirmation admin-save-confirmation-error" role="alert">
          <AlertTriangle className="h-4 w-4" />
          <span>{saveError || "Theme could not be saved. Try again."}</span>
        </div>
      )}

      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="colors" className="flex items-center gap-1">
            <Palette className="w-4 h-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography" className="flex items-center gap-1">
            <Type className="w-4 h-4" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-1">
            <Layout className="w-4 h-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="background" className="flex items-center gap-1">
            <ImagePlay className="w-4 h-4" />
            Background
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 relative">
            <ColorPicker
              id="primary"
              label="Primary Color"
              value={pendingTheme.primary}
              onChange={(color) => updatePendingTheme({ primary: color })}
            />
            <ColorPicker
              id="primaryGlow"
              label="Primary Glow"
              value={pendingTheme.primaryGlow}
              onChange={(color) => updatePendingTheme({ primaryGlow: color })}
            />
            <ColorPicker
              id="background"
              label="Background"
              value={pendingTheme.background}
              onChange={(color) => {
                const update: Partial<ThemeConfig> = { background: color };
                if (pendingTheme.backgroundMedia?.type === 'gradient') {
                  update.backgroundGradient = { ...pendingTheme.backgroundGradient, from: color };
                }
                updatePendingTheme(update);
              }}
            />
            <ColorPicker
              id="backgroundSecondary"
              label="Background Secondary"
              value={pendingTheme.backgroundSecondary}
              onChange={(color) => updatePendingTheme({ backgroundSecondary: color })}
            />
            <ColorPicker
              id="card"
              label="Card Background"
              value={pendingTheme.card}
              onChange={(color) => updatePendingTheme({ card: color })}
            />
            {/* Card blur tint controls - stored on pendingTheme.cardBlurTint (not part of ThemeConfig type) */}
            <div>
              <Label className="text-sm">Card Blur Tint</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border-2 border-border cursor-pointer transition-all hover:scale-110"
                  style={{ backgroundColor: (pendingTheme as any).cardBlurTint || '#ffffff' }}
                  onClick={() => setActiveColorPicker(activeColorPicker === 'cardTint' ? null : 'cardTint')}
                />
                <Input
                  value={(pendingTheme as any).cardBlurTint || '#ffffff'}
                  onChange={(e) => updatePendingTheme({ ...(pendingTheme as any), cardBlurTint: e.target.value } as any)}
                  className="font-mono text-xs"
                />
              </div>
              {activeColorPicker === 'cardTint' && (
                <div className="absolute z-50 mt-2">
                  <div className="fixed inset-0" onClick={() => setActiveColorPicker(null)} />
                  <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
                    <HexColorPicker color={(pendingTheme as any).cardBlurTint || '#ffffff'} onChange={(c) => updatePendingTheme({ ...(pendingTheme as any), cardBlurTint: c } as any)} />
                  </div>
                </div>
              )}
            </div>
            <ColorPicker
              id="foreground"
              label="Text Color"
              value={pendingTheme.foreground}
              onChange={(color) => updatePendingTheme({ foreground: color })}
            />
            <ColorPicker
              id="muted"
              label="Muted Text"
              value={pendingTheme.muted}
              onChange={(color) => updatePendingTheme({ muted: color })}
            />
            {/* Accent color removed - mirrors primary color now */}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Background Gradient</h3>
            <div className="grid grid-cols-2 gap-4 relative">
              <ColorPicker
                id="bgGradientFrom"
                label="Gradient Start"
                value={pendingTheme.backgroundGradient.from}
                onChange={(color) => updatePendingTheme({
                  backgroundGradient: { ...pendingTheme.backgroundGradient, from: color }
                })}
              />
              <ColorPicker
                id="bgGradientTo"
                label="Gradient End"
                value={pendingTheme.backgroundGradient.to}
                onChange={(color) => updatePendingTheme({
                  backgroundGradient: { ...pendingTheme.backgroundGradient, to: color }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gradient Direction</Label>
              <Select
                value={pendingTheme.backgroundGradient.direction}
                onValueChange={(direction) => updatePendingTheme({
                  backgroundGradient: { ...pendingTheme.backgroundGradient, direction }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0deg">Top to Bottom</SelectItem>
                  <SelectItem value="90deg">Left to Right</SelectItem>
                  <SelectItem value="135deg">Diagonal (Top-Left to Bottom-Right)</SelectItem>
                  <SelectItem value="45deg">Diagonal (Bottom-Left to Top-Right)</SelectItem>
                  <SelectItem value="180deg">Bottom to Top</SelectItem>
                  <SelectItem value="270deg">Right to Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={pendingTheme.fontFamily}
                onValueChange={(fontFamily) => updatePendingTheme({ fontFamily })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                  <SelectItem value="Poppins, system-ui, sans-serif">Poppins</SelectItem>
                  <SelectItem value="Roboto, system-ui, sans-serif">Roboto</SelectItem>
                  <SelectItem value="Montserrat, system-ui, sans-serif">Montserrat</SelectItem>
                  <SelectItem value="Open Sans, system-ui, sans-serif">Open Sans</SelectItem>
                  <SelectItem value="Lato, system-ui, sans-serif">Lato</SelectItem>
                  <SelectItem value="Playfair Display, serif">Playfair Display</SelectItem>
                  <SelectItem value="Georgia, serif">Georgia</SelectItem>
                  <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Per-item font sizes are managed individually in Profile and Link editors. Removed from global theme to avoid confusion.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Card Border Radius: {pendingTheme.cardRadius}px</Label>
              <Slider
                value={[pendingTheme.cardRadius]}
                onValueChange={([value]) => updatePendingTheme({ cardRadius: value })}
                max={24}
                min={0}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Card Spacing: {pendingTheme.cardSpacing}px</Label>
              <Slider
                value={[pendingTheme.cardSpacing]}
                onValueChange={([value]) => updatePendingTheme({ cardSpacing: value })}
                max={32}
                min={4}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Glow Intensity: {pendingTheme.glowIntensity}</Label>
              <Slider
                value={[pendingTheme.glowIntensity]}
                onValueChange={([value]) => updatePendingTheme({ glowIntensity: value })}
                max={1}
                min={0}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label>Blur Intensity: {pendingTheme.blurIntensity}px</Label>
              <Slider
                value={[pendingTheme.blurIntensity]}
                onValueChange={([value]) => updatePendingTheme({ blurIntensity: value })}
                max={50}
                min={0}
                step={1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Width</Label>
            <Select
              value={pendingTheme.maxWidth}
              onValueChange={(maxWidth) => updatePendingTheme({ maxWidth })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20rem">Small (320px)</SelectItem>
                <SelectItem value="24rem">Medium (384px)</SelectItem>
                <SelectItem value="28rem">Large (448px)</SelectItem>
                <SelectItem value="32rem">Extra Large (512px)</SelectItem>
                <SelectItem value="36rem">XXL (576px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="background" className="space-y-4">
          <BackgroundMediaCustomizer
            config={pendingTheme.backgroundMedia}
            onChange={(backgroundMedia) => updatePendingTheme({ backgroundMedia })}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
