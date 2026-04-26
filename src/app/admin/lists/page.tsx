"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, X, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { listSchema, type ListFormData } from "@/lib/validation";
import type { EmailList } from "@/lib/types";

export default function ListsPage() {
  const [lists, setLists] = useState<EmailList[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ListFormData>({
    resolver: zodResolver(listSchema),
  });

  const fetchLists = async () => {
    const res = await fetch("/api/lists");
    if (res.ok) setLists(await res.json());
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const onSubmit = async (data: ListFormData) => {
    if (editingId) {
      await fetch("/api/lists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...data }),
      });
    } else {
      await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    reset();
    setShowForm(false);
    setEditingId(null);
    fetchLists();
  };

  const handleEdit = (list: EmailList) => {
    setValue("name", list.name);
    setValue("description", list.description);
    setEditingId(list.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("리스트와 소속 구독자가 모두 삭제됩니다. 계속하시겠습니까?"))
      return;
    await fetch("/api/lists", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchLists();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">이메일 리스트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            구독자를 그룹별로 관리하세요
          </p>
        </div>
        <button
          onClick={() => {
            reset();
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          새 리스트
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mb-6 p-4 border border-border rounded-lg bg-muted/20"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {editingId ? "리스트 수정" : "새 리스트"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                reset();
              }}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <input
                {...register("name")}
                placeholder="리스트명 *"
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>
            <input
              {...register("description")}
              placeholder="설명 (선택)"
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>
          <button
            type="submit"
            className="mt-3 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md"
          >
            {editingId ? "수정" : "생성"}
          </button>
        </form>
      )}

      {lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          이메일 리스트가 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-sm transition-shadow"
            >
              <div>
                <h3 className="font-medium text-sm">{list.name}</h3>
                {list.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {list.subscriberCount || 0}명
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(list)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDelete(list.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
