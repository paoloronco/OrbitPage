import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Edit, Camera, Linkedin, Github, Instagram, Facebook, Twitter, Youtube } from "lucide-react";
import { TikTokIcon, DiscordIcon, TelegramIcon, WhatsAppIcon, MastodonIcon } from "./SocialIcons";
import { Switch } from "@/components/ui/switch";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { internalAssetPath, withBasePath } from "@/lib/base-path";
import { isAllowedRasterImageFile, RASTER_IMAGE_ACCEPT } from "@/lib/media-validation";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    discord?: string;
    telegram?: string;
    whatsapp?: string;
    mastodon?: string;
  };
  // Per-profile typography
  nameFontSize?: string;
  bioFontSize?: string;
  // Site metadata
  tabTitle?: string;
  metaDescription?: string;
  // Footer and browser bar customization
  footerText?: string;
  favicon?: string;
}

interface ProfileSectionProps {
  profile: ProfileData;
  onProfileUpdate: (profile: ProfileData) => void;
}

export const ProfileSection = ({ profile, onProfileUpdate }: ProfileSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const current = isEditing ? editProfile : profile;
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Keep editable state in sync with incoming profile when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditProfile(profile);
    }
  }, [profile, isEditing]);

  const handleSave = () => {
    onProfileUpdate(editProfile);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditProfile(profile);
    setIsEditing(false);
  };

  const processImage = async (file: File): Promise<string> => {
    // Reject unreasonable files early (pre-compress)
    const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_INPUT_BYTES) {
      throw new Error('Selected file is too large (max 20MB).');
    }

    // Helper to load an image from a src and return the image element
    const loadImageFromSrc = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(new Error('Could not load the selected image from provided source.'));
      image.src = src;
    });

    if (!isAllowedRasterImageFile(file)) {
      throw new Error('Unsupported image type. Use PNG, JPG, GIF, or WebP.');
    }

    // Try loading from object URL first, then fall back to data URL if needed
    let objectUrl: string | null = null;
    let dataUrl: string | null = null;
    let img: HTMLImageElement | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
      img = await loadImageFromSrc(objectUrl);
      // success
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    } catch (err) {
      // try data URL fallback
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        objectUrl = null;
      }
      try {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || ''));
          fr.onerror = () => reject(new Error('Failed to read file as data URL.'));
          fr.readAsDataURL(file);
        });
        img = await loadImageFromSrc(dataUrl);
      } catch (err2) {
        throw new Error('Could not load the selected image. The file may be corrupt or in an unsupported format.');
      }
    }

    // Resize to fit within bounds while keeping aspect ratio
    const MAX_DIM = 512; // avatar-friendly, keeps payload small
    let { width, height } = img;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported.');
    try {
      ctx.drawImage(img as HTMLImageElement, 0, 0, width, height);
    } catch (drawErr) {
      // Canvas draw may fail for certain SVGs or security-restricted images. If so, return original data URL if available.
      if (dataUrl) return dataUrl;
      // As a last resort, if we still have the original file as an object URL, attempt to return that (but it won't be persisted across sessions)
      if (objectUrl) return objectUrl;
      throw new Error('Failed to process image on canvas. Try a different image or smaller file.');
    }

    // Decide output format
    const isPng = file.type === 'image/png';
    // If PNG is small, keep PNG to preserve transparency; otherwise use JPEG for photos
    const usePng = isPng && file.size < 2 * 1024 * 1024; // <2MB
    const quality = 0.9; // good quality for avatars
    const mime = usePng ? 'image/png' : 'image/jpeg';

    const outputDataUrl = canvas.toDataURL(mime, quality);

    // Final payload sanity check (~base64 expands by ~33%)
    const approxBytes = Math.ceil((outputDataUrl.length - 'data:;base64,'.length) * 0.75);
    const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5MB after compression
    if (approxBytes > MAX_OUTPUT_BYTES) {
      throw new Error('Processed image is still too large. Try a smaller image.');
    }

    return outputDataUrl;
  };

  const getAvatarUrl = (avatar?: string | null) => {
    if (!avatar) return profileAvatar as unknown as string;
    if (avatar.startsWith('data:') || avatar.startsWith('blob:') || avatar.startsWith('http')) return avatar;
    return internalAssetPath(avatar) || (profileAvatar as unknown as string);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Unsupported file type. Please select an image.');
      }
      const processed = await processImage(file);
      setEditProfile(prev => ({ ...prev, avatar: processed }));
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to process the selected image.');
    }
  };

  return (
    <Card className="glass-card p-8 text-center transition-smooth hover:glow-effect">
      <div className="relative inline-block mb-6">
        {current.showAvatar !== false && (
        <Avatar className="w-24 h-24">
          <AvatarImage
            src={getAvatarUrl(current.avatar)}
            alt={current.name || 'User'}
            onError={(e) => { (e.target as HTMLImageElement).src = withBasePath('/placeholder.svg'); }}
          />
          <AvatarFallback className="text-2xl font-bold gradient-text">
            {(current.name && current.name.length > 0) ? current.name.charAt(0) : 'U'}
          </AvatarFallback>
        </Avatar>
        )}
        {isEditing && (
          <Button
            size="icon"
            variant="glass"
            className="absolute -bottom-2 -right-2 rounded-full w-8 h-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-4 h-4" />
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={RASTER_IMAGE_ACCEPT}
          onChange={handleAvatarUpload}
          className="hidden"
        />
        {uploadError && (
          <p className="text-xs text-destructive mt-2">{uploadError}</p>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          {/* Show Avatar Toggle */}
          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="show-avatar" className="text-sm">Show image or logo</Label>
            <Switch
              id="show-avatar"
              checked={editProfile.showAvatar !== false}
              onCheckedChange={(checked) => setEditProfile(prev => ({ ...prev, showAvatar: !!checked }))}
            />
          </div>

          <Input
            value={editProfile.name}
            onChange={(e) => setEditProfile(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Name, brand, venue, or project"
            className="glass-card border-primary/20 text-center text-xl font-semibold"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name Font Size (px)</Label>
              <Input
                type="number"
                value={parseInt(editProfile.nameFontSize || '24', 10)}
                onChange={(e) => setEditProfile(prev => ({ ...prev, nameFontSize: `${e.target.value}px` }))}
                className="h-8 w-full"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description Font Size (px)</Label>
              <Input
                type="number"
                value={parseInt(editProfile.bioFontSize || '14', 10)}
                onChange={(e) => setEditProfile(prev => ({ ...prev, bioFontSize: `${e.target.value}px` }))}
                className="h-8 w-full"
              />
            </div>
          </div>
          <Textarea
            value={editProfile.bio}
            onChange={(e) => setEditProfile(prev => ({ ...prev, bio: e.target.value }))}
            placeholder="Tell people what this page is for..."
            className="glass-card border-primary/20 text-center resize-none"
            rows={3}
          />
          <div className="space-y-1">
            <Label className="text-xs">Browser Tab Title</Label>
            <Input
              value={editProfile.tabTitle || ''}
              onChange={(e) => setEditProfile(prev => ({ ...prev, tabTitle: e.target.value }))}
              placeholder="Title shown in browser tab"
              className="glass-card border-primary/20 text-sm text-center"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Meta Description</Label>
            <Textarea
              value={editProfile.metaDescription || ''}
              onChange={(e) => setEditProfile(prev => ({ ...prev, metaDescription: e.target.value }))}
              placeholder="Short description for search engines and previews"
              className="glass-card border-primary/20 text-sm"
              rows={2}
            />
          </div>

          {/* Browser bar & Footer customization */}
          <div className="space-y-3 pt-4 border-t border-primary/10">
            <Label className="text-sm font-medium">Browser bar &amp; Footer</Label>
            <div className="space-y-1">
              <Label className="text-xs">Favicon (emoji or image URL)</Label>
              <div className="flex items-center gap-2">
                {editProfile.favicon && (
                  <span className="text-2xl leading-none select-none" title="Preview">
                    {editProfile.favicon.match(/^https?:\/\//) ? '🌐' : editProfile.favicon}
                  </span>
                )}
                <Input
                  value={editProfile.favicon || ''}
                  onChange={(e) => setEditProfile(prev => ({ ...prev, favicon: e.target.value }))}
                  placeholder="e.g. 🔗 or https://example.com/icon.png"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <p className="text-[10px] text-muted-foreground opacity-70">
                Use a single emoji or paste an image URL. Leave empty for the default icon.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Footer text</Label>
              <Textarea
                value={editProfile.footerText || ''}
                onChange={(e) => setEditProfile(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="e.g. © 2025 Your Name · All rights reserved"
                className="glass-card border-primary/20 text-sm"
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground opacity-70">
                Shown above the "Powered by OrbitPage" attribution (always visible).
              </p>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-3 pt-4 border-t border-primary/10">
            <Label className="text-sm font-medium">Social Links</Label>
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-blue-600" />
                <Input
                  value={editProfile.socialLinks?.linkedin || ''}
                  onChange={(e) => setEditProfile(prev => ({ 
                    ...prev, 
                    socialLinks: { ...prev.socialLinks, linkedin: e.target.value }
                  }))}
                  placeholder="https://linkedin.com/in/username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-foreground" />
                <Input
                  value={editProfile.socialLinks?.github || ''}
                  onChange={(e) => setEditProfile(prev => ({ 
                    ...prev, 
                    socialLinks: { ...prev.socialLinks, github: e.target.value }
                  }))}
                  placeholder="https://github.com/username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                <Input
                  value={editProfile.socialLinks?.instagram || ''}
                  onChange={(e) => setEditProfile(prev => ({ 
                    ...prev, 
                    socialLinks: { ...prev.socialLinks, instagram: e.target.value }
                  }))}
                  placeholder="https://instagram.com/username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-blue-700" />
                <Input
                  value={editProfile.socialLinks?.facebook || ''}
                  onChange={(e) => setEditProfile(prev => ({ 
                    ...prev, 
                    socialLinks: { ...prev.socialLinks, facebook: e.target.value }
                  }))}
                  placeholder="https://facebook.com/username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Twitter className="w-4 h-4 text-foreground" />
                <Input
                  value={editProfile.socialLinks?.twitter || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                  }))}
                  placeholder="https://x.com/username or https://twitter.com/username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-600" />
                <Input
                  value={editProfile.socialLinks?.youtube || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, youtube: e.target.value }
                  }))}
                  placeholder="https://youtube.com/@channel"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <TikTokIcon className="w-4 h-4 text-foreground" />
                <Input
                  value={editProfile.socialLinks?.tiktok || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, tiktok: e.target.value }
                  }))}
                  placeholder="https://tiktok.com/@username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <DiscordIcon className="w-4 h-4 text-indigo-500" />
                <Input
                  value={editProfile.socialLinks?.discord || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, discord: e.target.value }
                  }))}
                  placeholder="https://discord.gg/invite"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <TelegramIcon className="w-4 h-4 text-blue-500" />
                <Input
                  value={editProfile.socialLinks?.telegram || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, telegram: e.target.value }
                  }))}
                  placeholder="https://t.me/username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <WhatsAppIcon className="w-4 h-4 text-green-500" />
                <Input
                  value={editProfile.socialLinks?.whatsapp || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, whatsapp: e.target.value }
                  }))}
                  placeholder="https://wa.me/number"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <MastodonIcon className="w-4 h-4 text-violet-500" />
                <Input
                  value={editProfile.socialLinks?.mastodon || ''}
                  onChange={(e) => setEditProfile(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, mastodon: e.target.value }
                  }))}
                  placeholder="https://mastodon.social/@username"
                  className="glass-card border-primary/20 text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button onClick={handleSave} variant="gradient" size="sm">
              Save
            </Button>
            <Button onClick={handleCancel} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative group">
            <h1 className="font-bold text-foreground mb-2" style={{ ...(current.nameFontSize ? { fontSize: current.nameFontSize } : { fontSize: '2rem' }) }}>
              {current.name || "Your Name"}
            </h1>
            
            {/* Social Icons */}
            {current.socialLinks && Object.values(current.socialLinks).some(link => link) && (
              <div className="flex justify-center gap-3 mb-4">
                {current.socialLinks.linkedin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-blue-600/20"
                    onClick={() => window.open(current.socialLinks?.linkedin, '_blank')}
                  >
                    <Linkedin className="w-4 h-4 text-blue-600" />
                  </Button>
                )}
                {current.socialLinks.github && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-foreground/20"
                    onClick={() => window.open(current.socialLinks?.github, '_blank')}
                  >
                    <Github className="w-4 h-4 text-foreground" />
                  </Button>
                )}
                {current.socialLinks.instagram && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-pink-500/20"
                    onClick={() => window.open(current.socialLinks?.instagram, '_blank')}
                  >
                    <Instagram className="w-4 h-4 text-pink-500" />
                  </Button>
                )}
                {current.socialLinks.facebook && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-blue-700/20"
                    onClick={() => window.open(current.socialLinks?.facebook, '_blank')}
                  >
                    <Facebook className="w-4 h-4 text-blue-700" />
                  </Button>
                )}
                {current.socialLinks.twitter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-foreground/20"
                    onClick={() => window.open(current.socialLinks?.twitter, '_blank')}
                  >
                    <Twitter className="w-4 h-4 text-foreground" />
                  </Button>
                )}
                {current.socialLinks.youtube && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-red-600 hover:bg-red-600/20"
                    onClick={() => window.open(current.socialLinks?.youtube, '_blank')}
                  >
                    <Youtube className="w-4 h-4" />
                  </Button>
                )}
                {current.socialLinks.tiktok && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-foreground hover:bg-foreground/20"
                    onClick={() => window.open(current.socialLinks?.tiktok, '_blank')}
                  >
                    <TikTokIcon className="w-4 h-4" />
                  </Button>
                )}
                {current.socialLinks.discord && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-indigo-500 hover:bg-indigo-500/20"
                    onClick={() => window.open(current.socialLinks?.discord, '_blank')}
                  >
                    <DiscordIcon className="w-4 h-4" />
                  </Button>
                )}
                {current.socialLinks.telegram && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-blue-500 hover:bg-blue-500/20"
                    onClick={() => window.open(current.socialLinks?.telegram, '_blank')}
                  >
                    <TelegramIcon className="w-4 h-4" />
                  </Button>
                )}
                {current.socialLinks.whatsapp && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-green-500 hover:bg-green-500/20"
                    onClick={() => window.open(current.socialLinks?.whatsapp, '_blank')}
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                  </Button>
                )}
                {current.socialLinks.mastodon && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-violet-500 hover:bg-violet-500/20"
                    onClick={() => window.open(current.socialLinks?.mastodon, '_blank')}
                  >
                    <MastodonIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line" style={{ ...(current.bioFontSize ? { fontSize: current.bioFontSize } : {}) }}>
              {current.bio || "Add a description for this page..."}
            </p>
            <Button
              onClick={() => {
                // Ensure we edit the latest profile values
                setEditProfile(profile);
                setIsEditing(true);
              }}
               variant="ghost"
               size="icon"
               className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-smooth"
             >
               <Edit className="w-4 h-4" />
             </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
