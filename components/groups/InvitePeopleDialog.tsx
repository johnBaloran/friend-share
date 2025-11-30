"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Link as LinkIcon, Check } from "lucide-react";

interface InvitePeopleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  inviteCode: string;
}

export function InvitePeopleDialog({
  isOpen,
  onClose,
  groupId,
  groupName,
  inviteCode,
}: InvitePeopleDialogProps) {
  const [copied, setCopied] = useState(false);

  const invitationUrl = `${window.location.origin}/join/${inviteCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Invite People to {groupName}</DialogTitle>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Share this link with anyone you want to invite. They'll be able to join after signing in.
          </p>

          {/* Invitation Link */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2 mb-3">
              <Input
                value={invitationUrl}
                readOnly
                className="bg-white font-mono text-sm"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-blue-700">
              Share via email, WhatsApp, SMS, or any messaging app.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> This is a permanent link that never expires. If compromised, you can regenerate it from group settings.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
