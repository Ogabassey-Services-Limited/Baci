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
import type { NewBlogPostFormData } from './new-blog-post-types';

export function NewBlogPostAuthorTab({
  formData,
  handleChange,
}: {
  formData: NewBlogPostFormData;
  handleChange: (field: keyof NewBlogPostFormData, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Author Information</CardTitle>
        <CardDescription>For credibility (E-E-A-T)</CardDescription>
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
          <Label htmlFor="author_title">Author Title (optional)</Label>
          <Input
            id="author_title"
            placeholder="Founder, Product Expert"
            value={formData.author_title}
            onChange={(event) =>
              handleChange('author_title', event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author_bio">Author Bio (optional)</Label>
          <Textarea
            id="author_bio"
            placeholder="Brief bio"
            value={formData.author_bio}
            onChange={(event) => handleChange('author_bio', event.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </CardContent>
    </Card>
  );
}
