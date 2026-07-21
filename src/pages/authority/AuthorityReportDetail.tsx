import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import {
  ArrowLeft,
  ArrowRight,
  ThumbsUp,
  MessageCircle,
  Clock,
  MapPin,
  Paperclip,
  Lock,
  User,
  Phone,
  Mail,
  CreditCard,
} from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import MediaImage from "../../components/MediaImage";
import apiClient from "../../api/client";
import Skeleton from "../../components/Skeleton";
import Button from "../../components/Button";
import { useNotificationStore } from "../../store/notificationStore";
import { getStatusPinColor, createCustomIcon } from "../../utils/map";
import { normalizeReportDetail } from "../../utils/reports";
import {
  extractApiErrorMessage,
  normalizeReportStatusFromApi,
  reportStatusLabel,
  toApiReportStatus,
  toApiReportStatusInt,
} from "../../utils/reportStatus";
import type { Report, Attachment } from "../../types";

/* ─── Lightbox ─────────────────────────────────────────────── */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out"
      onClick={onClose}
    >
      <MediaImage
        src={src}
        alt="Preview"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}

/* ─── Reporter card ─────────────────────────────────────────── */
function ReporterCard({
  reporter,
  visibility,
  onImageClick,
  adminView = false,
}: {
  reporter: Report["reporter"];
  visibility: string;
  onImageClick: (src: string) => void;
  adminView?: boolean;
}) {
  const { t } = useTranslation();

  if (!adminView && (visibility === "Anonymous" || !reporter)) {
    return (
      <div className="bg-gray-800/60 border border-amber-700/40 rounded-xl p-5 flex flex-col items-center gap-3 text-center">
        <Lock className="w-8 h-8 text-amber-500" />
        <p className="font-bold text-amber-400 text-lg">{t('authority_report_detail.anonymous', 'مجهول الهوية')}</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          {t('authority_report_detail.anonymous_desc1', 'Reporter identity is hidden for Anonymous reports.')}
          <br />
          {t('authority_report_detail.anonymous_desc2', 'Contact a System Administrator if identity verification is required.')}
        </p>
      </div>
    );
  }

  if (!reporter) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">{t('authority_report_detail.no_reporter', 'No reporter information')}</p>
    );
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {reporter.profilePhotoUrl ? (
          <MediaImage
            src={reporter.profilePhotoUrl}
            alt={reporter.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-gray-600 cursor-pointer"
            onClick={() => onImageClick(reporter.profilePhotoUrl!)}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div>
          <p className="font-bold text-white">{reporter.name}</p>
          <p className="text-xs text-gray-500 capitalize">
            {t('authority_report_detail.report_type', '{{visibility}} report').replace('{{visibility}}', t(`visibility.${visibility.toLowerCase()}`, visibility))}
          </p>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-2 text-sm">
        {reporter.phone && (
          <div className="flex items-center gap-2 text-gray-300">
            <Phone className="w-4 h-4 text-gray-500 shrink-0" />
            <span dir="ltr">{reporter.phone}</span>
          </div>
        )}
        {reporter.email && (
          <div className="flex items-center gap-2 text-gray-300">
            <Mail className="w-4 h-4 text-gray-500 shrink-0" />
            <span>{reporter.email}</span>
          </div>
        )}
        {reporter.nationalId && (
          <div className="flex items-center gap-2 text-gray-300">
            <CreditCard className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="font-mono" dir="ltr">{reporter.nationalId}</span>
          </div>
        )}
      </div>

      {/* ID card images */}
      {(reporter.idCardUrl || reporter.idCardBackUrl) && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            {t('authority_report_detail.national_id', 'National ID')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {reporter.idCardUrl && (
              <div
                className="rounded-lg overflow-hidden border border-gray-700 cursor-zoom-in hover:border-blue-500 transition-colors"
                onClick={() => onImageClick(reporter.idCardUrl!)}
              >
                <MediaImage
                  src={reporter.idCardUrl}
                  alt="ID Front"
                  className="w-full h-24 object-cover"
                />
                <p className="text-[10px] text-gray-500 text-center py-1">
                  {t('authority_report_detail.front', 'Front')}
                </p>
              </div>
            )}
            {reporter.idCardBackUrl && (
              <div
                className="rounded-lg overflow-hidden border border-gray-700 cursor-zoom-in hover:border-blue-500 transition-colors"
                onClick={() => onImageClick(reporter.idCardBackUrl!)}
              >
                <MediaImage
                  src={reporter.idCardBackUrl}
                  alt="ID Back"
                  className="w-full h-24 object-cover"
                />
                <p className="text-[10px] text-gray-500 text-center py-1">
                  {t('authority_report_detail.back', 'Back')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function AuthorityReportDetail() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAdminView = location.pathname.startsWith("/admin/reports/");
  const backPath = isAdminView ? "/admin/reports" : "/authority/feed";
  const backLabel = isAdminView ? t('authority_report_detail.back_to_admin', 'Back to Report Management') : t('authority_report_detail.back_to_feed', 'Back to Feed');
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [noteContent, setNoteContent] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  // States for Social Interactions
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  /* Fetch report */
  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ["reports", id],
    queryFn: async () =>
      normalizeReportDetail((await apiClient.get(`/api/reports/${id}`)).data),
  });

  /* Fetch timeline */
  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["reports", id, "timeline"],
    queryFn: async () =>
      (await apiClient.get(`/api/reports/${id}/timeline`)).data,
  });

  /* Fetch social counts */
  const { data: likes } = useQuery({
    queryKey: ["social", "likes", id],
    queryFn: async () =>
      (await apiClient.get(`/api/social/reports/${id}/likes`)).data,
  });
  const { data: comments } = useQuery({
    queryKey: ["social", "comments", id],
    queryFn: async () =>
      (await apiClient.get(`/api/social/reports/${id}/comments`)).data,
  });

  /* Status mutation */
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const apiStatus = toApiReportStatus(newStatus);
      const statusInt = toApiReportStatusInt(newStatus);
      await apiClient.put(
        `/api/reports/${id}/status`,
        { status: statusInt },
        { headers: { "Content-Type": "application/json" } },
      );
      return apiStatus;
    },
    onSuccess: (apiStatus) => {
      queryClient.invalidateQueries({ queryKey: ["reports", id] });
      queryClient.invalidateQueries({ queryKey: ["reports", id, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["reports", "authority-feed"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      addToast({
        type: "success",
        title: t('authority_report_detail.toast_status_updated', 'Status Updated'),
        description: t('authority_report_detail.toast_status_desc', 'Report marked as {{status}}').replace('{{status}}', reportStatusLabel(apiStatus)),
      });
    },
    onError: (error) =>
      addToast({
        type: "error",
        title: t('authority_report_detail.toast_update_failed', 'Update Failed'),
        description: extractApiErrorMessage(error),
      }),
  });

  /* Notes mutation */
  const addNote = useMutation({
    mutationFn: async () =>
      apiClient.post(`/api/reports/${id}/notes`, { content: noteContent }),
    onSuccess: () => {
      setNoteContent("");
      queryClient.invalidateQueries({ queryKey: ["reports", id, "timeline"] });
      addToast({ type: "success", title: t('authority_report_detail.toast_note_added', 'Note Added') });
    },
  });

  /* Like mutation */
  const toggleLike = useMutation({
    mutationFn: async () => apiClient.post(`/api/social/reports/${id}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "likes", id] });
    },
    onError: () => addToast({ type: "error", title: t('authority_report_detail.toast_like_failed', 'Failed to like report') }),
  });

  /* Comment mutation */
  const addComment = useMutation({
    mutationFn: async () =>
      apiClient.post(`/api/social/reports/${id}/comments`, {
        text: commentText,
      }),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["social", "comments", id] });
      addToast({ type: "success", title: t('authority_report_detail.toast_comment_added', 'Comment Added') });
    },
    onError: () => addToast({ type: "error", title: t('authority_report_detail.toast_comment_failed', 'Failed to add comment') }),
  });

  /* Keyboard shortcuts */
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLInputElement
    )
      return;
    if (e.key.toLowerCase() === "d") setConfirmStatus("Dispatched");
    if (e.key.toLowerCase() === "r") setConfirmStatus("ReSolved");
    if (e.key.toLowerCase() === "x") setConfirmStatus("Rejected");
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleStatusConfirm = () => {
    if (!confirmStatus || !report) {
      setConfirmStatus(null);
      return;
    }
    const next = toApiReportStatus(confirmStatus);
    const current = normalizeReportStatusFromApi(report.status);
    if (next === current) {
      addToast({
        type: "info",
        title: t('authority_report_detail.toast_no_change', 'No Change'),
        description: t('authority_report_detail.toast_already_status', 'Report is already {{status}}.').replace('{{status}}', reportStatusLabel(current)),
      });
      setConfirmStatus(null);
      return;
    }
    updateStatus.mutate(next);
    setConfirmStatus(null);
  };

  if (isLoading)
    return <Skeleton type="card" className="max-w-6xl mx-auto mt-6 h-96" />;
  if (!report)
    return <div className="text-white text-center mt-10">{t('authority_report_detail.not_found', 'Report not found')}</div>;

  const lat = report.location?.latitude;
  const lng = report.location?.longitude;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-start">
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* Confirm dialog */}
      {confirmStatus && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-white text-lg mb-2">
              {t('authority_report_detail.confirm_status_title', 'Confirm Status Change')}
            </h3>
            <p className="text-gray-300 text-sm mb-1">
              {t('authority_report_detail.set_status_to', 'Set status to:')}{" "}
              <span className="font-bold text-white">{t(`status.${confirmStatus}`, confirmStatus)}</span>
            </p>
            {confirmStatus === "ReSolved" && (
              <div className="my-3 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-xs p-3 rounded-lg">
                {t('authority_report_detail.reward_msg', '✅ This will award')} <strong>{t('authority_report_detail.reward_points', '+10 trust points')}</strong>.
              </div>
            )}
            {confirmStatus === "Rejected" && (
              <div className="my-3 bg-red-900/30 border border-red-700/40 text-red-300 text-xs p-3 rounded-lg">
                {t('authority_report_detail.penalty_msg', '⚠ This will deduct')} <strong>{t('authority_report_detail.penalty_points', '-2 trust points')}</strong>.
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <Button
                onClick={handleStatusConfirm}
                isLoading={updateStatus.isPending}
                className="flex-1"
              >
                {t('authority_report_detail.confirm', 'Confirm')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmStatus(null)}
                className="flex-1"
              >
                {t('authority_report_detail.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          to={backPath}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {backLabel}
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-gray-500 truncate max-w-xs">
          {report.title}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left column ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-white mb-1">
                  {report.title}
                </h1>
                {report.authorityName && (
                  <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/40 px-2 py-0.5 rounded-full">
                    {t('authority_report_detail.assigned_to', 'Assigned to:')} {report.authorityName}
                  </span>
                )}
              </div>
              {/* Status updater */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <select
                    value={normalizeReportStatusFromApi(report.status)}
                    onChange={(e) => setConfirmStatus(e.target.value)}
                    disabled={updateStatus.isPending}
                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 text-start"
                  >
                    <option value="UnderReview">{t('status.UnderReview', 'Under Review')}</option>
                    <option value="Dispatched">{t('status.Dispatched', 'Dispatched')}</option>
                    <option value="ReSolved">{t('status.Resolved', 'Resolved')}</option>
                    <option value="Rejected">{t('status.Rejected', 'Rejected')}</option>
                  </select>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: getStatusPinColor(report.status),
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-600" dir="ltr">
                  {t('authority_report_detail.status_shortcuts', 'D=Dispatch · R=Resolve · X=Reject')}
                </p>
              </div>
            </div>

            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap mb-6">
              {report.description}
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-800/50 p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{t('authority_report_detail.category', 'Category:')}</span>
                <span className="text-white font-medium">
                  {report.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{t('authority_report_detail.sub_category', 'Sub-category:')}</span>
                <span className="text-white font-medium">
                  {report.subCategory}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{t('authority_report_detail.visibility', 'Visibility:')}</span>
                <span className="text-white font-medium capitalize">
                  {t(`visibility.${report.visibility.toLowerCase()}`, report.visibility)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-white font-medium" dir="ltr">
                  {formatDistanceToNow(new Date(report.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>

            {/* Social Interaction Buttons */}
            <div className="mt-6 pt-5 border-t border-gray-800">
              <div className="flex gap-6 text-sm text-gray-400 mb-4">
                <button
                  onClick={() => toggleLike.mutate()}
                  disabled={toggleLike.isPending}
                  className="flex items-center gap-1.5 hover:text-blue-400 transition-colors outline-none"
                >
                  <ThumbsUp
                    className={`w-4 h-4 ${likes?.isLikedByCurrentUser ? "fill-blue-500 text-blue-500" : ""}`}
                  />
                  {likes?.likeCount ?? 0} {t('authority_report_detail.likes', 'likes')}
                </button>

                <button
                  onClick={() => setShowComments(!showComments)}
                  className="flex items-center gap-1.5 hover:text-blue-400 transition-colors outline-none"
                >
                  <MessageCircle className="w-4 h-4" />
                  {Array.isArray(comments) ? comments.length : 0} {t('authority_report_detail.comments', 'comments')}
                </button>
              </div>

              {/* Comments Section (Expandable) */}
              {showComments && (
                <div className="space-y-4 bg-gray-800/30 p-4 rounded-xl border border-gray-800/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t('authority_report_detail.write_comment', 'Write a comment...')}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-start"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && commentText.trim()) {
                          addComment.mutate();
                        }
                      }}
                    />
                    <Button
                      onClick={() => addComment.mutate()}
                      isLoading={addComment.isPending}
                      disabled={!commentText.trim()}
                      className="px-4 py-2 h-auto"
                    >
                      {t('authority_report_detail.post', 'Post')}
                    </Button>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {Array.isArray(comments) && comments.length > 0 ? (
                      comments.map((c: any, i: number) => (
                        <div
                          key={i}
                          className="bg-gray-800/80 rounded-lg p-3 text-sm"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-white text-xs">
                              {c.userName || c.authorName || "User"}
                            </span>
                            {c.createdAt && (
                              <span className="text-[10px] text-gray-500" dir="ltr">
                                {formatDistanceToNow(new Date(c.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300">{c.content || c.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-xs text-center py-2">
                        {t('authority_report_detail.no_comments', 'No comments yet. Be the first!')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes & Timeline */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              {t('authority_report_detail.procedure_notes', 'Procedure Notes & Timeline')}
            </h2>

            {/* Add note */}
            <div className="flex gap-3 mb-6">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={t('authority_report_detail.add_note_placeholder', 'Add an internal procedure note…')}
                rows={3}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 resize-none text-start"
              />
              <Button
                onClick={() => addNote.mutate()}
                isLoading={addNote.isPending}
                disabled={!noteContent.trim()}
                className="shrink-0 self-start"
              >
                {t('authority_report_detail.add_note_btn', 'Add Note')}
              </Button>
            </div>

            {/* Timeline events */}
            <div className="space-y-3">
              {loadingTimeline ? (
                [1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="animate-pulse flex gap-4 p-4 bg-gray-800/50 rounded-xl"
                  >
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-700 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-700 rounded w-1/3" />
                      <div className="h-2.5 bg-gray-800 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : timeline?.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">
                  {t('authority_report_detail.no_timeline', 'No timeline events yet.')}
                </p>
              ) : (
                timeline?.map((event: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-800/60"
                  >
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-white">
                          {event.actorName || t('authority_report_detail.system', 'System')}
                        </span>
                        {event.type && (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded uppercase">
                            {event.type}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 ms-auto" dir="ltr">
                          {event.createdAt
                            ? formatDistanceToNow(new Date(event.createdAt), {
                                addSuffix: true,
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm">
                        {event.event || event.note || "—"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ─── Right column ─── */}
        <div className="space-y-6">
          {/* Location map */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" /> {t('authority_report_detail.location', 'Location')}
            </h3>
            {lat != null && lng != null ? (
              <div className="h-52 rounded-xl overflow-hidden border border-gray-700">
                <MapContainer
                  center={[lat, lng]}
                  zoom={15}
                  className="h-full w-full z-0"
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url={
                      import.meta.env.VITE_MAP_TILE_URL ||
                      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    }
                  />
                  <Marker
                    position={[lat, lng]}
                    icon={createCustomIcon(getStatusPinColor(report.status))}
                  />
                </MapContainer>
              </div>
            ) : (
              <div className="h-40 rounded-xl bg-gray-800 flex items-center justify-center text-gray-500 text-sm">
                {t('authority_report_detail.no_location', 'No location data')}
              </div>
            )}
            {report.locationName && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                {report.locationName}
              </p>
            )}
          </div>

          {/* Reporter card */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <h3 className="font-bold text-white mb-3">{t('authority_report_detail.reporter', 'Reporter')}</h3>
            <ReporterCard
              reporter={report.reporter}
              visibility={report.visibility}
              onImageClick={setLightboxSrc}
              adminView={isAdminView}
            />
          </div>

          {/* Attachments */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-400" />
              {t('authority_report_detail.attachments', 'Attachments')} ({report.attachments?.length ?? 0})
            </h3>
            {!report.attachments?.length ? (
              <p className="text-center text-gray-500 text-sm py-6">
                {t('authority_report_detail.no_attachments', 'No attachments')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {report.attachments.map((att: Attachment, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxSrc(att.filePath)}
                    className="block aspect-square rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500 hover:opacity-90 transition-all cursor-zoom-in"
                  >
                    {att.contentType?.startsWith("image") ||
                    !att.contentType ? (
                      <div className="relative w-full h-full">
                        <MediaImage
                          src={att.filePath}
                          alt={att.fileName}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-gray-300 truncate px-1 py-0.5">
                          {att.fileName}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center gap-1 text-gray-500">
                        <Paperclip className="w-6 h-6" />
                        <span className="text-[10px]">{att.fileName}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}