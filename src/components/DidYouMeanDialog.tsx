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
      <AlertDialogContent className="border-[#e3c4c4] bg-white text-stone-900">
        <AlertDialogHeader>
          <AlertDialogTitle>Did you mean {suggestion}?</AlertDialogTitle>
          <AlertDialogDescription className="text-stone-500">
            “{original}” looks like a possible misspelling. Add{" "}
            <span className="font-semibold text-stone-800">{suggestion}</span> to the map
            instead?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="border-[#d9b3b3] bg-transparent text-stone-700 hover:bg-[#f3dede] hover:text-stone-900"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[#b91c1c] text-white hover:bg-[#991b1b]"
          >
            Yes, add {suggestion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
