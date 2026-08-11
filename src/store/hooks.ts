import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

/** Typed dispatch hook. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** Typed selector hook. */
export const useAppSelector = useSelector.withTypes<RootState>();
