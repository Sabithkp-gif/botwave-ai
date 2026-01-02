
export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
}

export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export interface AICollaborator {
  id: string;
  name: string;
  role: string;
  avatar: string;
  instruction: string;
  isActive: boolean;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  lastActive: number;
}

export interface MessageContent {
  text?: string;
  image?: string;
  isCode?: boolean;
  language?: string;
  suggestions?: string[];
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: MessageContent;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
  collaborators: string[]; // IDs of active AI friends
  participants: Participant[]; // Real-time users in this room
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  preferredVoice: VoiceName;
  isPro: boolean;
  subscriptionPlan?: 'monthly' | 'yearly';
}
