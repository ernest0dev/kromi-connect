"use server";

import {
  archiveCampaignAction as archiveCampaign,
  createCampaignAction as createCampaign,
  getCampaignOptionsForGridAction as getCampaignOptionsForGrid,
  getCampaignsAction as getCampaigns,
  getCampaignsForGridMonthAction as getCampaignsForGridMonth,
  getCampaignsForGridPostsAction as getCampaignsForGridPosts,
  restoreCampaignAction as restoreCampaign,
  saveCampaignEvaluationAction as saveCampaignEvaluation,
  updateCampaignAction as updateCampaign,
  updateCampaignStatusAction as updateCampaignStatus,
} from "./campaign-actions";
import {
  createEfemerideAction as createEfemeride,
  deleteEfemerideAction as deleteEfemeride,
  getEfemeridesByYearAction as getEfemeridesByYear,
  getEfemeridesInYearRangeAction as getEfemeridesInYearRange,
  updateEfemerideAction as updateEfemeride,
} from "./efemerides-actions";
import type {
  CampanaEstatus,
  CreateCampaignInput,
  EfemerideInput,
  SaveCampaignEvaluationInput,
  UpdateCampaignInput,
} from "./types";

export async function getCampaignsAction() {
  return getCampaigns();
}

export async function getCampaignsForGridMonthAction(anio: number, mes: number) {
  return getCampaignsForGridMonth(anio, mes);
}

export async function getCampaignsForGridPostsAction(campaignIds: string[]) {
  return getCampaignsForGridPosts(campaignIds);
}

export async function getCampaignOptionsForGridAction() {
  return getCampaignOptionsForGrid();
}

export async function createCampaignAction(input: CreateCampaignInput) {
  return createCampaign(input);
}

export async function updateCampaignAction(id: string, input: UpdateCampaignInput) {
  return updateCampaign(id, input);
}

export async function updateCampaignStatusAction(id: string, status: CampanaEstatus) {
  return updateCampaignStatus(id, status);
}

export async function archiveCampaignAction(id: string) {
  return archiveCampaign(id);
}

export async function restoreCampaignAction(id: string) {
  return restoreCampaign(id);
}

export async function saveCampaignEvaluationAction(input: SaveCampaignEvaluationInput) {
  return saveCampaignEvaluation(input);
}

export async function getEfemeridesByYearAction(anio: number) {
  return getEfemeridesByYear(anio);
}

export async function getEfemeridesInYearRangeAction(anioInicio: number, anioFin: number) {
  return getEfemeridesInYearRange(anioInicio, anioFin);
}

export async function createEfemerideAction(input: EfemerideInput) {
  return createEfemeride(input);
}

export async function updateEfemerideAction(id: string, input: EfemerideInput) {
  return updateEfemeride(id, input);
}

export async function deleteEfemerideAction(id: string) {
  return deleteEfemeride(id);
}
