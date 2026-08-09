import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type DidYouMeanDialogProps = {
  open: boolean;
  original: string;
  suggestion: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DidYouMeanDialog({
  open,
  original,
  suggestion,
  onConfirm,
  onCancel,
}: DidYouMeanDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="border-slate-700 bg-[#0c1526] text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Did you mean {suggestion}?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            “{original}” looks like a possible misspelling. Add{" "}
            <span className="font-semibold text-slate-200">{suggestion}</span> to the map
            instead?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="border-slate-600 bg-transparent text-slate-300 hover:bg-slate-700/50 hover:text-slate-100"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-sky-500 text-white hover:bg-sky-400"
          >
            Yes, add {suggestion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
