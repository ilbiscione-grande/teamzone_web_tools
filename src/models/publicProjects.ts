import type { Project } from "./project";

export type PublicProjectStatus = "unverified" | "verified" | "reviewed";

export type PublicProject = {
  id: string;
  ownerId: string;
  ownerEmail: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: PublicProjectStatus;
  createdAt: string;
  updatedAt: string;
  projectData: Project;
};

export type PublicProjectReport = {
  id: string;
  projectId: string;
  reporterId: string;
  reporterEmail: string;
  reason: string;
  createdAt: string;
};
