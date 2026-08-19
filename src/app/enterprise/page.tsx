import ChatWindow from "@/components/chat/ChatWindow";
import GetAllProjectData from "@/components/chat/GetAllProjectData";
import UpdateProjectData from "@/components/chat/UpdateProjectData";
import { Suspense } from "react";

const page = () => {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500" />
        </div>
      }
    >
      <GetAllProjectData />
      <UpdateProjectData />
      <ChatWindow />
    </Suspense>
  );
};

export default page;
