"use client";

import React, { useEffect, useState } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";

interface Props {
  children: React.ReactNode;
  onDragEnd: (result: DropResult) => void;
}

export default function DndWrapper({ children, onDragEnd }: Props) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  return <DragDropContext onDragEnd={onDragEnd}>{children}</DragDropContext>;
}
