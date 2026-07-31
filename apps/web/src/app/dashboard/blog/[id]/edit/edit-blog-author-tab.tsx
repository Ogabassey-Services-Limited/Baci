import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PostFormData } from './edit-blog-types';

export function EditBlogAuthorTab({
  formData,
  handleChange,
}: {
  formData: PostFormData;
  handleChange: (field: keyof PostFormData, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Author Information</CardTitle>
        <CardDescription>
          Author details for E-E-A-T (Experience, Expertise, Authoritativeness,
          Trustworthiness)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="author_name">Author Name *</Label>
          <Input
            id="author_name"
            placeholder="Your name or business name"
            value={formData.author_name}
            onChange={(event) =>
              handleChange('author_name', event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author_title">Author Title</Label>
          <Input
            id="author_title"
            placeholder="Founder, Product Expert, Marketing Manager"
            value={formData.author_title}
            onChange={(event) =>
              handleChange('author_title', event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author_bio">Author Bio</Label>
          <Textarea
            id="author_bio"
            placeholder="Brief bio to establish expertise and credibility"
            value={formData.author_bio}
            onChange={(event) => handleChange('author_bio', event.target.value)}
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            {formData.author_bio.length}/500 characters
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
