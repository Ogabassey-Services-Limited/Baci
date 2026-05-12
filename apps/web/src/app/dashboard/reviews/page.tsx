'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle,
  Clock,
  // Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { StarRating } from '@/components/storefront/star-rating';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';

interface Review {
  id: string;
  product_id: string;
  customer_name?: string;
  customer_email: string;
  rating: number;
  title?: string;
  body?: string;
  status: 'pending' | 'approved' | 'rejected';
  verified_purchase: boolean;
  helpful_count: number;
  merchant_response?: string;
  merchant_response_at?: string;
  created_at: string;
  products?: {
    name: string;
    slug: string;
  };
}

export default function ReviewsPage() {
  const { toast } = useToast();
  const { merchant } = useMerchant();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);

  const fetchReviews = async () => {
    if (!merchant?.id) return;

    setIsLoading(true);
    try {
      // Fetch reviews for this merchant's products
      const response = await fetch(
        `/api/dashboard/reviews?status=${statusFilter}&search=${debouncedSearch}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reviews.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler auto-memoizes fetchReviews
  }, [fetchReviews]);

  const updateReviewStatus = async (
    reviewId: string,
    status: 'approved' | 'rejected'
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update review');
      }

      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status } : r))
      );

      toast({
        title: status === 'approved' ? 'Review Approved' : 'Review Rejected',
        description: `The review has been ${status}.`,
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to update review status.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const submitResponse = async () => {
    if (!selectedReview) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/reviews/${selectedReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_response: responseText }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit response');
      }

      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedReview.id
            ? {
                ...r,
                merchant_response: responseText,
                merchant_response_at: new Date().toISOString(),
              }
            : r
        )
      );

      setShowResponseDialog(false);
      setSelectedReview(null);
      setResponseText('');

      toast({
        title: 'Response Submitted',
        description: 'Your response has been added to the review.',
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to submit response.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteReview = async (reviewId: string) => {
    // In a real app, use a custom dialog instead of confirm
    // if (!confirm('Are you sure you want to delete this review?')) return;

    // For now, we'll proceed but this should be replaced with a proper UI dialog
    // to avoid blocking the thread and for better accessibility

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete review');
      }

      setReviews((prev) => prev.filter((r) => r.id !== reviewId));

      toast({
        title: 'Review Deleted',
        description: 'The review has been permanently deleted.',
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to delete review.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" /> Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
    }
  };

  const stats = {
    total: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
    averageRating:
      reviews.length > 0
        ? (
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          ).toFixed(1)
        : '0.0',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Reviews ⭐
        </h1>
        <p className="text-muted-foreground">
          Manage and respond to customer reviews
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reviews</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {stats.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {stats.approved}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1">
              {stats.averageRating}{' '}
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviews</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <BagLoader size={32} />
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No reviews found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StarRating rating={review.rating} size="sm" />
                      {getStatusBadge(review.status)}
                      {review.verified_purchase && (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" /> Verified
                        </Badge>
                      )}
                    </div>

                    {review.title && (
                      <h3 className="font-semibold text-lg">{review.title}</h3>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <span>
                        {review.customer_name || review.customer_email}
                      </span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(review.created_at))} ago
                      </span>
                      {review.products?.name && (
                        <>
                          <span>•</span>
                          <span>{review.products.name}</span>
                        </>
                      )}
                    </div>

                    {review.body && (
                      <p className="text-muted-foreground">{review.body}</p>
                    )}

                    {review.merchant_response && (
                      <div className="mt-4 bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">
                          Your Response:
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {review.merchant_response}
                        </p>
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {review.status === 'pending' && (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              updateReviewStatus(review.id, 'approved')
                            }
                            disabled={isUpdating}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateReviewStatus(review.id, 'rejected')
                            }
                            disabled={isUpdating}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedReview(review);
                          setResponseText(review.merchant_response || '');
                          setShowResponseDialog(true);
                        }}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {review.merchant_response
                          ? 'Edit Response'
                          : 'Add Response'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteReview(review.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Your response will be visible to customers viewing this review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedReview && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <StarRating rating={selectedReview.rating} size="sm" />
                  <span className="text-sm text-muted-foreground">
                    by{' '}
                    {selectedReview.customer_name ||
                      selectedReview.customer_email}
                  </span>
                </div>
                {selectedReview.title && (
                  <p className="font-medium">{selectedReview.title}</p>
                )}
                {selectedReview.body && (
                  <p className="text-sm text-muted-foreground">
                    {selectedReview.body}
                  </p>
                )}
              </div>
            )}
            <Textarea
              placeholder="Write your response..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResponseDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitResponse}
              disabled={isUpdating || !responseText.trim()}
            >
              {isUpdating && <BagLoader size={16} />}
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
