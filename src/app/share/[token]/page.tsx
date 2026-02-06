import ProjectShareView from "@/components/ProjectShareView";

type SharePageProps = {
  params: { token: string };
};

export default function SharePage({ params }: SharePageProps) {
  return <ProjectShareView token={params.token} />;
}
