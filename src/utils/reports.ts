import type { Attachment, ReporterDetails, Report } from '../types';
import { normalizeReportStatusFromApi } from './reportStatus';

export const UNAVAILABLE_REPORTER_NAME = 'مستخدم غير متاح';

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== '') return val as T;
  }
  return undefined;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/** Normalize nested or flat reporter blocks from any report DTO variant. */
export function normalizeReporter(raw: unknown): ReporterDetails | null {
  const obj = asRecord(raw);
  const nested = asRecord(obj.reporter ?? obj.Reporter);

  if (Object.keys(nested).length > 0) {
    const name =
      pick<string>(nested, 'name', 'Name', 'fullName', 'FullName') ??
      UNAVAILABLE_REPORTER_NAME;
    return {
      id: pick<string>(nested, 'id', 'Id', 'userId', 'UserId') ?? null,
      name,
      phone: pick<string>(nested, 'phone', 'Phone', 'phoneNumber', 'PhoneNumber') ?? null,
      email: pick<string>(nested, 'email', 'Email') ?? null,
      profilePhotoUrl:
        pick<string>(nested, 'profilePhotoUrl', 'ProfilePhotoUrl') ?? null,
      nationalId: pick<string>(nested, 'nationalId', 'NationalId') ?? null,
      idCardUrl:
        pick<string>(nested, 'idCardUrl', 'IdCardUrl', 'idCardFrontUrl', 'IdCardFrontUrl', 'idCardPhotoUrl', 'IdCardPhotoUrl') ??
        null,
      idCardBackUrl:
        pick<string>(nested, 'idCardBackUrl', 'IdCardBackUrl') ?? null,
    };
  }

  const flatName =
    pick<string>(obj, 'reporterName', 'ReporterName', 'userDisplayName', 'UserDisplayName');
  if (!flatName) return null;

  return {
    id: pick<string>(obj, 'reporterId', 'ReporterId', 'userId', 'UserId') ?? null,
    name: flatName,
    phone:
      pick<string>(obj, 'reporterPhone', 'ReporterPhone', 'userPhone', 'UserPhone') ??
      null,
    email:
      pick<string>(obj, 'reporterEmail', 'ReporterEmail', 'userEmail', 'UserEmail') ??
      null,
    profilePhotoUrl:
      pick<string>(obj, 'reporterPhotoUrl', 'ReporterPhotoUrl', 'profilePhotoUrl', 'ProfilePhotoUrl') ??
      null,
    nationalId: pick<string>(obj, 'nationalId', 'NationalId') ?? null,
    idCardUrl:
      pick<string>(obj, 'idCardFrontUrl', 'IdCardFrontUrl', 'idCardUrl', 'IdCardUrl') ??
      null,
    idCardBackUrl:
      pick<string>(obj, 'idCardBackUrl', 'IdCardBackUrl') ?? null,
  };
}

export function formatReportCategory(raw: unknown): string | null {
  const obj = asRecord(raw);
  const category = pick<string>(obj, 'category', 'Category', 'categoryName', 'CategoryName');
  const subCategory = pick<string>(
    obj,
    'subCategory',
    'SubCategory',
    'subcategoryName',
    'SubcategoryName',
    'subCategoryName',
    'SubCategoryName',
  );
  if (category && subCategory) return `${category} · ${subCategory}`;
  return category ?? subCategory ?? null;
}

export function normalizeAuthorityName(raw: unknown): string | null {
  const obj = asRecord(raw);
  const nested = asRecord(obj.authority ?? obj.Authority);
  return (
    pick<string>(obj, 'authorityName', 'AuthorityName', 'assignedAuthorityName', 'AssignedAuthorityName') ??
    pick<string>(nested, 'name', 'Name') ??
    null
  );
}

function normalizeAttachment(raw: unknown): Attachment {
  const obj = asRecord(raw);
  const filePath =
    pick<string>(obj, 'filePath', 'FilePath', 'fileUrl', 'FileUrl', 'url', 'Url') ?? '';
  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    fileName: pick<string>(obj, 'fileName', 'FileName') ?? '',
    filePath,
    contentType: pick<string>(obj, 'contentType', 'ContentType') ?? null,
    fileSize: String(pick(obj, 'fileSize', 'FileSize') ?? ''),
    aiValidated: Boolean(pick(obj, 'aiValidated', 'AiValidated') ?? false),
  };
}

export interface NormalizedReportListItem {
  id: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  categoryLabel: string | null;
  authorityName: string | null;
  createdAt: string;
  reporter: ReporterDetails | null;
}

export function normalizeReportListItem(raw: unknown): NormalizedReportListItem {
  const obj = asRecord(raw);
  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    title: pick<string>(obj, 'title', 'Title') ?? '',
    description: pick<string>(obj, 'description', 'Description') ?? '',
    status: normalizeReportStatusFromApi(
      pick<string>(obj, 'status', 'Status') ?? 'Unknown',
    ),
    visibility: pick<string>(obj, 'visibility', 'Visibility') ?? 'Public',
    categoryLabel: formatReportCategory(obj),
    authorityName: normalizeAuthorityName(obj),
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt') ?? '',
    reporter: normalizeReporter(obj),
  };
}

export function normalizeReportDetail(raw: unknown): Report {
  const obj = asRecord(raw);
  const attachmentsRaw = (obj.attachments ?? obj.Attachments) as unknown;
  const attachments = Array.isArray(attachmentsRaw)
    ? attachmentsRaw.map(normalizeAttachment)
    : [];
  const locationObj = asRecord(obj.location ?? obj.Location);

  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    title: pick<string>(obj, 'title', 'Title') ?? '',
    description: pick<string>(obj, 'description', 'Description') ?? '',
    status: normalizeReportStatusFromApi(
      pick<string>(obj, 'status', 'Status') ?? 'UnderReview',
    ) as Report['status'],
    visibility: (pick<string>(obj, 'visibility', 'Visibility') ?? 'Public') as Report['visibility'],
    category:
      pick<string>(obj, 'category', 'Category', 'categoryName', 'CategoryName') ?? '',
    subCategory:
      pick<string>(
        obj,
        'subCategory',
        'SubCategory',
        'subcategoryName',
        'SubcategoryName',
      ) ?? '',
    authorityName: normalizeAuthorityName(obj),
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt') ?? '',
    attachments,
    location: {
      latitude: Number(pick(locationObj, 'latitude', 'Latitude') ?? 0),
      longitude: Number(pick(locationObj, 'longitude', 'Longitude') ?? 0),
    },
    locationName: pick<string>(obj, 'locationName', 'LocationName') ?? null,
    locationMapUrl: pick<string>(obj, 'locationMapUrl', 'LocationMapUrl') ?? null,
    reporter: normalizeReporter(obj),
  };
}

export function parseReportFeedResponse(data: unknown): {
  callerAuthorityName: string | null;
  reports: NormalizedReportListItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
} {
  const body = asRecord(data);
  const rawList =
    body.reports ??
    body.Reports ??
    body.items ??
    body.Items ??
    body.data ??
    body.Data ??
    (Array.isArray(data) ? data : []);

  const reports = Array.isArray(rawList)
    ? rawList.map(normalizeReportListItem)
    : [];

  const apiTotal = Number(
    pick(body, 'totalCount', 'TotalCount', 'count', 'Count') ?? NaN,
  );
  const totalCount = Number.isFinite(apiTotal) && apiTotal > 0 ? apiTotal : reports.length;
  const apiPages = Number(pick(body, 'totalPages', 'TotalPages') ?? NaN);
  const totalPages =
    Number.isFinite(apiPages) && apiPages > 0
      ? apiPages
      : reports.length < 20
        ? 1
        : 2;

  return {
    callerAuthorityName:
      pick<string>(body, 'callerAuthorityName', 'CallerAuthorityName') ?? null,
    reports,
    totalCount,
    totalPages,
    page: Number(pick(body, 'page', 'Page') ?? 1),
    pageSize: Number(pick(body, 'pageSize', 'PageSize') ?? 20),
  };
}
